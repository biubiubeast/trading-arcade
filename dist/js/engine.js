// Model v1: European, cash settled; multiplier 1; USD; r=q=0.
export const MARKET = Object.freeze({
  spot: 100,
  days: 30,
  vol: 0.4,
  fee: 0.1,
  multiplier: 1,
});
export function cdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const p =
    1 -
    (Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI)) *
      t *
      (0.31938153 +
        t *
          (-0.356563782 +
            t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? p : 1 - p;
}
export function value(
  type,
  strike,
  spot,
  days = MARKET.days,
  vol = MARKET.vol
) {
  if (type === "stock") return spot;
  if (type === "cash") return 10;
  if (days <= 0 || vol <= 0 || spot <= 0)
    return Math.max(type === "call" ? spot - strike : strike - spot, 0);
  const t = days / 365,
    sd = vol * Math.sqrt(t),
    d1 = (Math.log(spot / strike) + (sd * sd) / 2) / sd,
    d2 = d1 - sd;
  return type === "call"
    ? spot * cdf(d1) - strike * cdf(d2)
    : strike * cdf(-d2) - spot * cdf(-d1);
}
export const quote = (leg, market = MARKET) =>
  value(leg.type, leg.strike, market.spot, market.days, market.vol);
export const fees = (legs, market = MARKET) =>
  legs.reduce((sum, l) => sum + Math.abs(l.qty) * market.fee, 0);
export const debit = (legs, market = MARKET) =>
  legs.reduce((sum, l) => sum + l.qty * quote(l, market), 0) +
  fees(legs, market);
export const pnl = (legs, spot, days = 0, vol, market = MARKET) =>
  legs.reduce(
    (sum, l) =>
      sum + l.qty * value(l.type, l.strike, spot, days, vol ?? market.vol),
    0
  ) - debit(legs, market);
export const units = legs => legs.reduce((sum, l) => sum + Math.abs(l.qty), 0);
export function analyze(legs, market = MARKET) {
  const knots = [
    ...new Set([
      0,
      ...legs.filter(l => ["call", "put"].includes(l.type)).map(l => l.strike),
    ]),
  ].sort((a, b) => a - b);
  const vals = knots.map(s => pnl(legs, s, 0, undefined, market));
  const slope = legs.reduce(
    (sum, l) => sum + (["call", "stock"].includes(l.type) ? l.qty : 0),
    0
  );
  const min = slope < 0 ? -Infinity : Math.min(...vals),
    max = slope > 0 ? Infinity : Math.max(...vals);
  const roots = [];
  const flat = [];
  const push = x => {
    if (!roots.some(r => Math.abs(r - x) < 1e-5)) roots.push(x);
  };
  for (let i = 0; i < knots.length; i++) {
    if (Math.abs(vals[i]) < 1e-8) push(knots[i]);
    if (i < knots.length - 1) {
      if (Math.abs(vals[i]) < 1e-8 && Math.abs(vals[i + 1]) < 1e-8)
        flat.push([knots[i], knots[i + 1]]);
      else if (vals[i] * vals[i + 1] < 0)
        push(
          knots[i] -
            (vals[i] * (knots[i + 1] - knots[i])) / (vals[i + 1] - vals[i])
        );
    }
  }
  const last = knots.at(-1),
    v = vals.at(-1);
  if (slope !== 0 && -v / slope > 1e-8) push(last - v / slope);
  if (slope === 0 && Math.abs(v) < 1e-8) flat.push([last, Infinity]);
  return {
    debit: debit(legs, market),
    fees: fees(legs, market),
    maxLoss: Math.max(0, -min),
    maxProfit: Math.max(0, max),
    breakevens: roots.sort((a, b) => a - b),
    flat,
    tailSlope: slope,
  };
}
export function mergeLeg(legs, leg, maxUnits = 8) {
  const next = legs.map(l => ({ ...l }));
  const existing = next.find(
    l => l.type === leg.type && l.strike === leg.strike
  );
  if (existing) existing.qty += leg.qty;
  else next.push({ ...leg });
  const filtered = next.filter(l => l.qty !== 0);
  return units(filtered) > maxUnits ? null : filtered;
}
export function checkLevel(level, legs) {
  const market = level.market || MARKET;
  const a = analyze(legs, market);
  const valid =
    legs.length > 0 &&
    units(legs) <= level.maxUnits &&
    legs.every(
      l =>
        Number.isInteger(l.qty) &&
        l.qty !== 0 &&
        level.types.includes(l.type) &&
        (["call", "put"].includes(l.type)
          ? level.strikes.includes(l.strike)
          : l.strike === 0) &&
        (level.sell || l.qty > 0)
    );
  const checks = level.goals.map(g => {
    const actual =
      g.kind === "debit"
        ? a.debit
        : g.kind === "loss"
          ? a.maxLoss
          : g.kind === "tailSlope"
            ? a.tailSlope
            : g.kind === "payoff"
              ? pnl(legs, g.spot, 0, undefined, market) + a.debit
              : pnl(legs, g.spot, 0, undefined, market);
    return {
      ...g,
      actual,
      pass:
        valid &&
        (g.op === "lte" ? actual <= g.limit + 1e-6 : actual >= g.limit - 1e-6),
    };
  });
  return {
    valid,
    checks,
    pass: valid && checks.every(c => c.pass),
    analysis: a,
  };
}
export function delta(legs, spot = 100, days = 30, vol = 0.4) {
  return (
    (pnl(legs, spot + 0.001, days, vol) - pnl(legs, spot - 0.001, days, vol)) /
    0.002
  );
}
