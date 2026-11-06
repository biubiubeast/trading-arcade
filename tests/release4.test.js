import test from "node:test";
import assert from "node:assert/strict";
import { STARTER_PACK } from "../dist/js/course-presets.js";
import {
  addCourse,
  readLibrary,
  writeLibrary,
  fingerprint,
  LIBRARY_KEY,
} from "../dist/js/course-library.js";
import { normalizePack } from "../dist/js/content.js";
import { runtimeCourse } from "../dist/js/course-ui.js";
import {
  DEFAULT_RULES,
  normalizeRules,
  engineConfig,
  evaluateRules,
  seedBatch,
  predictionSummary,
} from "../dist/js/gamma/rules.js";
import {
  runPolicy,
  result,
  snapshot,
  decide,
  startGame,
} from "../dist/js/gamma/engine.js";
import { restoreSession, serializeSession } from "../dist/js/gamma/view.js";
import {
  CASES,
  evaluateDesign,
  validateSubmission,
  normalizeDesign,
} from "../dist/js/structured/engine.js";
import { readStructured } from "../dist/js/structured/view.js";
const near = (a, b, t = 1e-7) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`),
  clone = x => structuredClone(x);
const storage = () => {
  const m = new Map();
  return { getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, v) };
};
test("library keeps changed content as a separate revision without altering old task IDs", () => {
  const a = addCourse([], STARTER_PACK),
    old = clone(a.items);
  const p = clone(STARTER_PACK);
  p.lessons[0].brief += " 改版";
  const b = addCourse(a.items, p);
  assert.equal(b.change, "revision");
  assert.equal(b.entry.revision, 2);
  assert.deepEqual(a.items, old);
  assert.notEqual(
    runtimeCourse(a.entry.pack)[0].id,
    runtimeCourse(b.entry.pack)[0].id
  );
  assert.equal(addCourse(b.items, p).change, "same");
});
test("library round-trip and legacy active pack migration validate every course", () => {
  const s = storage(),
    a = addCourse([], STARTER_PACK);
  writeLibrary(s, a.items);
  assert.deepEqual(readLibrary(s, null), a.items);
  assert.equal(readLibrary(storage(), STARTER_PACK).length, 1);
  s.setItem(
    LIBRARY_KEY,
    JSON.stringify({
      version: 1,
      items: [{ pack: {} }, { pack: STARTER_PACK }],
    })
  );
  assert.equal(readLibrary(s, null).length, 1);
});
test("library cap rejects the new version without deleting existing courses", () => {
  let items = [];
  for (let i = 0; i < 12; i++) {
    const p = clone(STARTER_PACK);
    p.id = "custom-pack-" + i;
    items = addCourse(items, p).items;
  }
  const p = clone(STARTER_PACK);
  p.id = "custom-extra";
  assert.throws(() => addCourse(items, p));
  assert.equal(items.length, 12);
});
test("course validation identifies the task and market field of a bad input", () => {
  const p = clone(STARTER_PACK);
  p.lessons[1].market.vol = 99;
  assert.throws(() => normalizePack(p), /lessons\[1\].*market.vol/);
  assert.equal(
    fingerprint(STARTER_PACK),
    fingerprint(normalizePack(STARTER_PACK))
  );
});
test("editable hedge rules reject invalid values and unknown financial extensions", () => {
  for (const p of [
    { threshold: 0 },
    { feeBps: -1 },
    { spreadBps: Infinity },
    { interval: 1.5 },
    { capital: 1e9 },
  ])
    assert.throws(() => normalizeRules(p));
  assert.deepEqual(normalizeRules(DEFAULT_RULES), DEFAULT_RULES);
});
test("threshold and interval parameters change decisions rather than only labels", () => {
  const a = runPolicy(
      "roundtrip",
      42,
      "threshold",
      engineConfig({ ...DEFAULT_RULES, threshold: 1 })
    ),
    b = runPolicy(
      "roundtrip",
      42,
      "threshold",
      engineConfig({ ...DEFAULT_RULES, threshold: 100 })
    );
  assert.ok(a.trades.length > b.trades.length);
  const c = runPolicy(
    "roundtrip",
    42,
    "timed",
    engineConfig({ ...DEFAULT_RULES, interval: 4 })
  );
  assert.deepEqual(
    c.decisions.map(x => x.fraction),
    [1, 0, 0, 0, 1, 0, 0, 0]
  );
});
test("session version 2 retains custom locked rules and pending trade across refresh", () => {
  let s = decide(
    startGame(
      "unknown",
      7,
      engineConfig({ threshold: 9, interval: 3, feeBps: 12, spreadBps: 8 })
    ),
    0.5
  );
  s.learning = { predictions: { 0: 1 }, reflection: "" };
  assert.deepEqual(restoreSession(serializeSession(s)), s);
});
test("legacy Gamma sessions replay with original default costs and thresholds", () => {
  const raw = {
    version: 1,
    kind: "roundtrip",
    seed: 42,
    index: 8,
    choices: Array(8).fill(1),
  };
  const a = restoreSession(raw),
    b = runPolicy("roundtrip", 42, "neutral");
  near(result(a).pnl, result(b).pnl);
  assert.equal(a.c.threshold, 15);
});
test("session restoration rejects invalid new rules and future or malformed predictions", () => {
  const raw = serializeSession(startGame());
  assert.throws(() =>
    restoreSession({ ...raw, rules: { ...DEFAULT_RULES, feeBps: 999 } })
  );
  assert.throws(() =>
    restoreSession({
      ...raw,
      learning: { predictions: { 6: 2 }, reflection: "" },
    })
  );
  assert.throws(() =>
    restoreSession({
      ...raw,
      learning: { predictions: { 0: 4 }, reflection: "" },
    })
  );
});
test("new path batches are deterministic, bounded and contain unique paired seeds", () => {
  assert.deepEqual(seedBatch(1), seedBatch(1));
  assert.notDeepEqual(seedBatch(1), seedBatch(2));
  assert.equal(new Set(seedBatch(1)).size, 32);
  assert.throws(() => seedBatch(1, 1000));
});
test("multipath statistics use the exact same seeds and rules for all policies", () => {
  const e = evaluateRules(DEFAULT_RULES, 123, 8);
  assert.equal(e.count, 8);
  for (const p of e.policies) {
    assert.equal(p.rows.length, 8);
    for (let i = 0; i < 8; i++)
      near(
        p.rows[i].pnl,
        result(
          runPolicy(
            "unknown",
            e.seeds[i],
            p.policy,
            engineConfig(DEFAULT_RULES)
          )
        ).pnl
      );
    assert.ok(p.stats.p10 <= p.stats.median && p.stats.median <= p.stats.p90);
  }
});
test("paired cost sensitivity reduces mean P&L by exactly the incremental costs", () => {
  const e = evaluateRules(DEFAULT_RULES, 89, 8),
    [zero, base, high] = e.sensitivity;
  near(zero.stats.meanPnl - base.stats.meanPnl, base.stats.meanCost);
  near(
    base.stats.meanPnl - high.stats.meanPnl,
    high.stats.meanCost - base.stats.meanCost
  );
  assert.ok(high.stats.meanCost > base.stats.meanCost);
});
test("first predictions have separate knowledge counts with no P&L input", () => {
  assert.deepEqual(predictionSummary({ predictions: { 0: 0, 3: 1, 6: 0 } }), {
    answered: 3,
    correct: 2,
  });
});
test("all structured reference designs meet client constraints and all defaults expose a tradeoff", () => {
  for (const c of CASES) {
    assert.ok(evaluateDesign(c.id, c.reference).pass, c.id);
    assert.equal(evaluateDesign(c.id, c.defaults).pass, false, c.id);
  }
});
test("partial protection worked example has honest budget and client P&L", () => {
  const r = evaluateDesign(
    "participation",
    { floor: 95, participation: 0.8 },
    140
  );
  near(r.assetCost, 98.65794908958815);
  near(r.fee, 0.08);
  near(r.margin, 1.26205091041185);
  near(r.payoff, 127);
  near(r.customerPnl, 27);
});
test("zero-rate 100% protection plus positive participation is not free", () => {
  const r = evaluateDesign("participation", { floor: 100, participation: 0.8 });
  assert.equal(r.pass, false);
  near(-r.margin, 3.73794908958815);
});
test("income coupon comes from short Put and does not prevent principal loss", () => {
  const a = evaluateDesign("income", { coupon: 3 }, 0),
    b = evaluateDesign("income", { coupon: 3 }, 140);
  near(a.payoff, 3);
  near(a.customerPnl, -97);
  near(b.payoff, 103);
  near(a.margin, 1.472436361985183);
});
test("collar keeps endowed stock, charges only two option legs and retains premium cash", () => {
  const a = evaluateDesign("collar", { putStrike: 90, callStrike: 110 }, 0),
    b = evaluateDesign("collar", { putStrike: 90, callStrike: 110 }, 200);
  near(a.fee, 0.2);
  near(a.cash, 0.1123352766763965);
  near(a.payoff, 90.1123352766764);
  near(b.payoff, 110.1123352766764);
  near(a.issuerPnl, 0);
  assert.equal(a.legs.find(l => l.type === "stock").qty, 1);
});
test("structured books reconcile at zero, all kinks, dense states and right tail", () => {
  for (const c of CASES)
    for (const spot of [
      0,
      80,
      90,
      95,
      100,
      110,
      120,
      130,
      200,
      2000,
      ...Array.from({ length: 51 }, (_, i) => i * 3.7),
    ]) {
      const r = evaluateDesign(c.id, c.reference, spot);
      near(r.conservation, 0);
      const asset = r.legs.reduce(
        (s, l) =>
          s +
          (l.type === "cash"
            ? l.qty
            : l.qty *
              (l.type === "stock"
                ? spot
                : Math.max(
                    l.type === "call" ? spot - l.strike : l.strike - spot,
                    0
                  ))),
        0
      );
      near(asset, r.payoff);
      near(r.issuerPnl, c.id === "collar" ? 0 : r.margin);
    }
});
test("structured submission requires clarification, correct funding concept and explanation", () => {
  const c = CASES[0],
    d = c.reference;
  assert.throws(() =>
    validateSubmission(c.id, d, {
      clarified: false,
      answer: 1,
      explanation: "权利金用于支付上涨参与，仍承担信用风险。",
    })
  );
  assert.throws(() =>
    validateSubmission(c.id, d, {
      clarified: true,
      answer: 0,
      explanation: "这是一个错误的资金来源解释。",
    })
  );
  assert.throws(() =>
    validateSubmission(c.id, d, {
      clarified: true,
      answer: 1,
      explanation: "短",
    })
  );
  assert.ok(
    validateSubmission(c.id, d, {
      clarified: true,
      answer: 1,
      explanation: "现金承担到期底线，Call 提供参与，但仍假设发行方履约。",
    }).pass
  );
});
test("structured storage restores only revalidated completion and handles denied storage", () => {
  const s = storage();
  s.setItem(
    "trade-arcade:structured:v1",
    JSON.stringify({
      version: 1,
      selected: "income",
      drafts: { income: { coupon: 3 } },
      completed: {
        income: {
          design: { coupon: 10 },
          clarified: true,
          answer: 0,
          explanation: "不能信任存储的未通过设计。",
        },
      },
    })
  );
  const p = readStructured(s);
  assert.equal(p.selected, "income");
  assert.deepEqual(p.drafts.income, { coupon: 3 });
  assert.deepEqual(p.completed, {});
  assert.equal(
    Object.keys(
      readStructured({
        getItem() {
          throw Error("denied");
        },
      }).completed
    ).length,
    0
  );
});
test("structured design schema rejects unknown fields and nonfinite or out-of-range terms", () => {
  assert.throws(() => normalizeDesign("income", { coupon: 3, barrier: 70 }));
  assert.throws(() =>
    normalizeDesign("participation", { floor: 100, participation: Infinity })
  );
  assert.throws(() =>
    evaluateDesign("collar", { putStrike: 110, callStrike: 90 })
  );
});
test("removed active courses stay removed after refresh and remaining revision numbers survive", () => {
  const s = storage(),
    a = addCourse([], STARTER_PACK);
  const p = clone(STARTER_PACK);
  p.title += " 第二版";
  const b = addCourse(a.items, p);
  writeLibrary(s, [b.entry]);
  assert.equal(readLibrary(s, STARTER_PACK)[0].revision, 2);
  assert.equal(readLibrary(s, STARTER_PACK).length, 1);
  writeLibrary(s, []);
  assert.deepEqual(readLibrary(s, STARTER_PACK), []);
});
test("course reference legs reject unknown fields and optional text does not accept nonstrings", () => {
  const p = clone(STARTER_PACK);
  p.lessons[0].solution[0].code = "ignored";
  assert.throws(() => normalizePack(p), /solution\[0\]/);
  delete p.lessons[0].solution[0].code;
  p.lessons[0].hint = 5;
  assert.throws(() => normalizePack(p), /hint/);
});
