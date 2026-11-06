import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePack,
  normalizeLesson,
  portablePack,
  parseJson,
  enumerate,
  createShare,
  readShare,
  importedProgress,
} from "../dist/js/content.js";
import { STARTER_PACK } from "../dist/js/course-presets.js";
import { LEVELS } from "../dist/js/levels.js";
import { analyze, pnl, checkLevel } from "../dist/js/engine.js";
import { runtimeCourse, escapeText } from "../dist/js/course-ui.js";
import { readProgress } from "../dist/js/storage.js";
import { createRouter } from "../dist/js/core/navigation.js";
const clone = x => structuredClone(x),
  pack = () => clone(STARTER_PACK);
const blank = () => readProgress({ getItem: () => null });
function bad(change) {
  const p = pack();
  change(p);
  assert.throws(() => normalizePack(p));
}

test("starter course is feasible where stated and certifies its restricted impossible task", () => {
  const p = normalizePack(pack());
  assert.equal(p.lessons.length, 3);
  for (const l of p.lessons)
    if (!l.infeasible) assert.ok(checkLevel(l, l.solution).pass);
  const proof = p.lessons[2].certificate;
  assert.equal(proof.feasible, false);
  assert.ok(proof.checked > 0);
});
test("reference answer is checked, not trusted", () => {
  bad(p => (p.lessons[0].solution = [{ type: "call", strike: 90, qty: 1 }]));
  bad(p => (p.lessons[0].solution[0].qty = 0));
  bad(p => p.lessons[0].solution.push({ ...p.lessons[0].solution[0] }));
});
test("market ranges, finite numbers, enums, duplicate IDs and formulas are rejected", () => {
  bad(p => (p.lessons[0].market.vol = Infinity));
  bad(p => (p.lessons[0].market.multiplier = 100));
  bad(p => (p.lessons[0].types = ["exotic"]));
  bad(p => (p.lessons[0].formula = "alert(1)"));
  bad(p => p.lessons.push(clone(p.lessons[0])));
  bad(p => (p.lessons[0].goals[0].op = "eval"));
});
test("prototype keys and oversized input cannot pass JSON boundary", () => {
  assert.throws(() => parseJson('{"__proto__":{"x":1}}'));
  assert.throws(() => parseJson('{"lessons":[{"constructor":3}]}'));
  assert.throws(() => parseJson(" ".repeat(250001)));
  assert.throws(() => parseJson("{bad"));
});
test("a false impossibility claim and an oversized search space are rejected", () => {
  bad(p => {
    p.lessons[2].goals[0].limit = 10;
  });
  bad(p => (p.lessons[2].maxUnits = 8));
});
test("synthetic cash leg reproduces stock terminal payment while retaining fees", () => {
  const l = normalizePack(pack()).lessons[1],
    a = analyze(l.solution, l.market);
  for (let s = 0; s <= 200; s += 0.7)
    assert.ok(
      Math.abs(pnl(l.solution, s, 0, undefined, l.market) + a.debit - s) < 1e-7
    );
  assert.ok(a.fees > 0);
  assert.equal(a.tailSlope, 1);
});
test("UTF-8 share links round-trip and carry only the allowed structure", () => {
  const l = normalizePack(pack()).lessons[0],
    code = createShare(l, l.solution),
    r = readShare(code);
  assert.equal(r.lesson.title, l.title);
  assert.deepEqual(r.legs, l.solution);
  assert.equal(code.includes("/"), false);
  assert.throws(() => readShare("not valid!"));
  assert.throws(() => readShare("a".repeat(18001)));
});
test("unavailable or fractional shared positions are rejected", () => {
  const l = normalizePack(pack()).lessons[0];
  assert.throws(() => createShare(l, [{ type: "put", strike: 100, qty: 1 }]));
  assert.throws(() =>
    createShare(l, [{ type: "call", strike: 100, qty: 0.5 }])
  );
});
test("course content changes get a different progress namespace", () => {
  const a = runtimeCourse(normalizePack(pack()));
  const p = pack();
  p.lessons[0].market.fee = 0.09;
  const b = runtimeCourse(normalizePack(p));
  assert.notEqual(a[0].id, b[0].id);
  assert.equal(a[1].id, b[1].id);
  assert.deepEqual(
    runtimeCourse(normalizePack(portablePack(normalizePack(pack())))),
    a
  );
});
test("external titles are escaped in both text and attribute contexts", () => {
  const p = pack();
  p.title = '<img src=x onerror="alert(1)">';
  const clean = normalizePack(p);
  const escaped = escapeText(clean.title);
  assert.ok(!escaped.includes("<"));
  assert.ok(!escaped.includes('"'));
});
test("progress merge recalculates completion and preserves an existing draft", () => {
  const current = blank(),
    l = LEVELS[0];
  current.drafts[l.id] = [{ type: "call", strike: 110, qty: 1 }];
  const incoming = {
    application: "交易游乐场 · 期权积木",
    version: 2,
    progress: {
      completed: { [l.id]: { stars: 3, legs: l.solution } },
      drafts: { [l.id]: l.solution },
      hintUse: { [l.id]: 1 },
    },
  };
  const r = importedProgress(incoming, LEVELS, current);
  assert.equal(r.next.completed[l.id].stars, 2);
  assert.deepEqual(r.next.drafts[l.id], current.drafts[l.id]);
  assert.equal(current.completed[l.id], undefined);
  incoming.progress.completed[l.id].legs = [
    { type: "call", strike: 90, qty: 1 },
  ];
  assert.throws(() => importedProgress(incoming, LEVELS, current));
});
test("invalid draft import is rejected before any merge is applied", () => {
  const p = blank(),
    incoming = {
      application: "交易游乐场 · 期权积木",
      version: 3,
      progress: {
        drafts: { [LEVELS[0].id]: [{ type: "call", strike: 999, qty: 1 }] },
      },
    };
  assert.throws(() => importedProgress(incoming, LEVELS, p));
  assert.deepEqual(p.drafts, {});
});
test("game router releases the previous module on every route transition", () => {
  const calls = [],
    module = n => ({
      mount: () => calls.push(n + " mount"),
      unmount: () => calls.push(n + " stop"),
    });
  const router = createRouter(id => module(id));
  router.mount("payoff", {});
  router.mount("gamma", {});
  router.unmount();
  assert.deepEqual(calls, [
    "payoff mount",
    "payoff stop",
    "gamma mount",
    "gamma stop",
  ]);
});
