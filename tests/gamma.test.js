import test from "node:test";
import assert from "node:assert/strict";
import {
  CONFIG,
  greeks,
  startGame,
  makePath,
  snapshot,
  decide,
  advance,
  runPolicy,
  result,
  replayDecisions,
  SCENARIOS,
} from "../dist/js/gamma/engine.js";
import { restoreSession, serializeSession } from "../dist/js/gamma/view.js";
const near = (a, b, t = 1e-7) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
test("known straddle quote, multiplier and nonzero ATM Delta", () => {
  const g = greeks(100, 30, 0.6);
  near(g.value, 1370.790789, 1e-5);
  near(g.delta, 6.853954, 1e-5);
  assert.ok(g.gamma > 0 && g.theta < 0 && g.vega > 0);
});
test("analytic Greeks agree with finite differences and display Vega per percentage point", () => {
  const g = greeks(103, 20, 0.6),
    e = 0.01,
    up = greeks(103 + e, 20, 0.6),
    down = greeks(103 - e, 20, 0.6);
  near((up.value - down.value) / (2 * e), g.delta, 0.001);
  near((up.delta - down.delta) / (2 * e), g.gamma, 0.001);
  near(
    ((greeks(103, 20, 0.60001).value - greeks(103, 20, 0.59999).value) /
      0.00002) *
      0.01,
    g.vega,
    0.001
  );
});
test("entry equity equals starting capital minus option entry fee", () => {
  const s = startGame();
  near(snapshot(s).equity, CONFIG.capital - s.initialOption * CONFIG.feeRate);
});
test("a hedge is self-financing apart from explicit fee and half-spread", () => {
  const s = startGame(),
    old = snapshot(s),
    d = decide(s, 1),
    now = snapshot(d),
    t = d.trades[0];
  near(now.delta, 0);
  near(now.equity, old.equity - t.fee - t.spread);
  near(d.cash, s.cash - t.qty * old.spot - t.fee - t.spread);
  assert.equal(s.stock, 0);
});
test("half hedge halves net Delta and holding creates no stock trade", () => {
  const s = startGame();
  near(snapshot(decide(s, 0.5)).delta, snapshot(s).delta * 0.5);
  assert.equal(decide(s, 0).trades.length, 0);
});
test("no advance before a decision and no second decision at old price", () => {
  const s = startGame();
  assert.throws(() => advance(s));
  const chosen = decide(s, 1);
  assert.throws(() => decide(chosen, 1));
  assert.throws(() => decide(s, 0.3));
  const next = advance(chosen);
  assert.equal(next.index, 1);
  assert.equal(chosen.trades[0].spot, 100);
  assert.equal(next.path[1].spot, 105);
});
test("cash ledger reconciles across all scenarios and benchmark policies", () => {
  for (const scenario of SCENARIOS)
    for (const policy of ["none", "timed", "threshold"]) {
      const s = runPolicy(scenario.id, 71, policy),
        r = result(s);
      assert.ok(r.reconciled, scenario.id);
      let cash = s.c.capital - s.initialOption - s.initialOption * s.c.feeRate;
      for (const t of s.trades) cash -= t.qty * t.spot + t.fee + t.spread;
      cash += s.settlement.optionValue - s.settlement.optionExitFee;
      near(cash, s.cash);
      near(r.optionGross + r.stockGross - r.cost, s.cash - s.c.capital);
      near(
        Object.values(r.approx).reduce((a, b) => a + b, 0) +
          r.residual -
          r.cost,
        r.pnl
      );
      assert.equal(s.stock, 0);
    }
});
test("the original 100→110→100 teaching example gives 368.18 before costs", () => {
  let s = startGame("roundtrip", 42, { feeRate: 0, spreadRate: 0 });
  s.path = [
    { spot: 100, days: 30, iv: 0.6, time: 0 },
    { spot: 110, days: 29, iv: 0.6, time: 1 },
    { spot: 100, days: 28, iv: 0.6, time: 2 },
  ];
  s = advance(decide(s, 1));
  s = advance(decide(s, 1));
  const r = result(s);
  near(r.optionGross, -46.372188, 1e-5);
  near(r.stockGross, 414.550435, 1e-5);
  near(r.pnl, 368.178247, 1e-5);
});
test("same endpoints give same option change, but different dynamic hedge results", () => {
  const a = result(runPolicy("roundtrip", 42, "timed")),
    b = result(runPolicy("quiet", 42, "timed"));
  near(a.optionGross, b.optionGross);
  assert.notEqual(a.stockGross, b.stockGross);
});
test("expiry scenario settles intrinsic value once and disallows further trading", () => {
  const s = runPolicy("expiry", 42, "timed");
  assert.equal(s.settlement.expiry, true);
  assert.equal(s.settlement.optionExitFee, 0);
  near(s.settlement.optionValue, Math.abs(s.path.at(-1).spot - 100) * 100);
  assert.throws(() => advance(s));
  assert.throws(() => decide(s, 0));
});
test("higher costs reduce the same policy result by exactly the cost difference", () => {
  const a = result(
      runPolicy("roundtrip", 42, "timed", { feeRate: 0, spreadRate: 0 })
    ),
    b = result(runPolicy("roundtrip", 42, "timed"));
  near(a.pnl - b.pnl, b.cost);
  near(a.optionGross, b.optionGross);
  near(a.stockGross, b.stockGross);
});
test("no-hedge baseline has zero stock P&L; profitable path need not meet risk rules", () => {
  const r = result(runPolicy("jump", 42, "none"));
  near(r.stockGross, 0);
  assert.ok(r.pnl > 0);
  assert.ok(r.riskAdherence < 1);
});
test("seeded paths and replay are deterministic", () => {
  assert.deepEqual(makePath("unknown", 7), makePath("unknown", 7));
  assert.notDeepEqual(makePath("unknown", 7), makePath("unknown", 8));
  const s = runPolicy("unknown", 7, "timed");
  assert.deepEqual(
    replayDecisions(
      s.kind,
      s.seed,
      s.decisions.map(d => d.fraction)
    ),
    s
  );
});
test("a pending decision and a completed game restore without duplicate execution", () => {
  const s = decide(startGame(), 0.5);
  assert.deepEqual(restoreSession(serializeSession(s)), s);
  const done = runPolicy("roundtrip", 8, "threshold");
  assert.deepEqual(restoreSession(serializeSession(done)), done);
});
test("malformed or overlong saved sessions cannot replay arbitrary rules", () => {
  for (const raw of [
    {},
    { version: 1, kind: "unknown", seed: 1, index: 9, choices: [] },
    { version: 1, kind: "unknown", seed: 1, index: 0, choices: [1, 1] },
    { version: 1, kind: "roundtrip", seed: 1, index: 1, choices: [99] },
  ])
    assert.throws(() => restoreSession(raw));
});
