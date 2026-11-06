import test from "node:test";
import assert from "node:assert/strict";
import {
  MARKET,
  quote,
  pnl,
  debit,
  analyze,
  checkLevel,
} from "../dist/js/engine.js";
import { LEVELS } from "../dist/js/levels.js";
import {
  TRANSFERS,
  PREDICTIONS,
  newTimeline,
  recordStep,
  moveStep,
  restoreTimeline,
  predictionResult,
} from "../dist/js/learning.js";
import {
  KEY,
  LEGACY_KEY,
  readProgress,
  saveProgress,
  validDraft,
} from "../dist/js/storage.js";
const a = [{ type: "call", strike: 100, qty: 1 }],
  b = [...a, { type: "call", strike: 110, qty: -1 }];
const near = (x, y) => assert.ok(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
test("every transfer reference meets all constraints in its own market", () => {
  for (const l of TRANSFERS) {
    assert.ok(checkLevel(l, l.solution).pass, l.id);
    assert.equal(checkLevel(l, []).pass, false);
  }
});
test("higher fee shifts all expiry scenarios by exactly incremental net-unit fee", () => {
  const m = TRANSFERS[1].market;
  for (const s of [0, 80, 100, 110, 120, 10000])
    near(pnl(b, s) - pnl(b, s, 0, undefined, m), 1.8);
  near(debit(b, m) - debit(b), 1.8);
  near(analyze(b, m).maxLoss - analyze(b).maxLoss, 1.8);
});
test("new initial spot changes entry quotes rather than only chart labels", () => {
  const l = TRANSFERS[0],
    m = l.market;
  near(quote(l.solution[0], m), quote(a[0]) * 1.1);
  assert.notEqual(debit(l.solution, m), debit(l.solution));
  near(checkLevel(l, l.solution).analysis.debit, debit(l.solution, m));
});
test("each market uses fixed entry price when mark IV changes", () => {
  for (const l of TRANSFERS) {
    const m = l.market;
    near(
      pnl(l.solution, m.spot, m.days, m.vol, m),
      -l.solution.reduce((s, x) => s + Math.abs(x.qty) * m.fee, 0)
    );
    const cost = debit(l.solution, m);
    pnl(l.solution, m.spot, 10, 0.9, m);
    near(debit(l.solution, m), cost);
  }
});
test("history deep-copies positions and undo/redo does not mutate previous snapshots", () => {
  const draft = structuredClone(a);
  let t = newTimeline([]);
  t = recordStep(t, draft, "买入");
  draft[0].qty = 6;
  assert.equal(t.steps[1].legs[0].qty, 1);
  t = recordStep(t, b, "价差");
  const undo = moveStep(t, -1);
  assert.deepEqual(undo.steps[undo.cursor].legs, a);
  assert.equal(moveStep(undo, 1).cursor, 2);
  assert.equal(moveStep(t, 100).cursor, 2);
  assert.equal(moveStep(t, -100).cursor, 0);
});
test("editing after undo discards obsolete future; identical edits do not create steps", () => {
  let t = recordStep(recordStep(newTimeline([]), a, "a"), b, "b");
  t = moveStep(t, -1);
  t = recordStep(t, [{ ...a[0], strike: 90 }], "new");
  assert.equal(t.steps.length, 3);
  assert.equal(t.steps[2].label, "new");
  assert.equal(recordStep(t, t.steps[2].legs, "same"), t);
});
test("history retains at most 50 valid snapshots", () => {
  let t = newTimeline([]);
  for (let i = 0; i < 100; i++)
    t = recordStep(t, [{ ...a[0], qty: (i % 2) + 1 }], String(i));
  assert.equal(t.steps.length, 50);
  assert.equal(t.cursor, 49);
});
test("invalid or mismatched stored history safely starts from current draft", () => {
  const validate = x => validDraft(x, LEVELS[1]);
  const t = recordStep(newTimeline([]), a, "add");
  assert.deepEqual(restoreTimeline(t, a, validate), t);
  for (const raw of [
    { ...t, cursor: 10 },
    { ...t, steps: [{ legs: [{ type: "call", strike: 999, qty: 1 }] }] },
    { ...t, cursor: 0 },
  ])
    assert.deepEqual(restoreTimeline(raw, a, validate), newTimeline(a));
});
test("prediction answers are separate and invalid choices cannot be marked correct", () => {
  assert.equal(Object.keys(PREDICTIONS).length, 6);
  for (const l of LEVELS) {
    const q = PREDICTIONS[l.id];
    assert.equal(predictionResult(l.id, q.answer).correct, true);
    assert.equal(predictionResult(l.id, (q.answer + 1) % 3).correct, false);
  }
  assert.equal(predictionResult("unknown", 0), null);
  assert.equal(predictionResult("first-call", 99), null);
});
test("v1 migration retains drafts/stars/hints without deleting original storage", () => {
  const data = new Map([
    [
      LEGACY_KEY,
      JSON.stringify({
        version: 1,
        lastLevel: 1,
        completed: { "first-call": { stars: 3 } },
        drafts: { "bull-spread": b },
        hintUse: { "bull-spread": 2 },
      }),
    ],
  ]);
  const store = {
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
  const p = readProgress(store);
  assert.equal(p.version, 2);
  assert.equal(p.completed["first-call"].stars, 3);
  assert.equal(p.hintUse["bull-spread"], 2);
  assert.deepEqual(p.drafts["bull-spread"], b);
  saveProgress(p, store);
  assert.ok(data.has(LEGACY_KEY));
  assert.ok(data.has(KEY));
  assert.equal(readProgress(store).lastLevel, 1);
});
test("v2 restoration keeps transfer history and first choice across refresh", () => {
  const p = {
    version: 2,
    lastMode: "transfer",
    lastTransfer: 1,
    predictions: { "first-call": { choice: 0, correct: true } },
    sessions: { x: recordStep(newTimeline([]), a, "add") },
  };
  const r = readProgress({ getItem: () => JSON.stringify(p) });
  assert.equal(r.lastMode, "transfer");
  assert.equal(r.lastTransfer, 1);
  assert.equal(r.predictions["first-call"].correct, undefined);
  assert.equal(
    predictionResult("first-call", r.predictions["first-call"].choice).correct,
    false
  );
  assert.equal(r.sessions.x.cursor, 1);
});
