import { value, cdf } from "../engine.js";
export const RULES_VERSION = 2;
export const CONFIG = Object.freeze({
  capital: 10000,
  strike: 100,
  multiplier: 100,
  days: 30,
  iv: 0.6,
  feeRate: 0.0005,
  spreadRate: 0.0005,
  maxStock: 200,
  threshold: 15,
  interval: 2,
});
const pdf = x => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
export function greeks(spot, days, iv, c = CONFIG) {
  if (days <= 0)
    return {
      value:
        value("call", c.strike, spot, 0, iv) * c.multiplier +
        value("put", c.strike, spot, 0, iv) * c.multiplier,
      delta:
        spot > c.strike ? c.multiplier : spot < c.strike ? -c.multiplier : 0,
      gamma: 0,
      vega: 0,
      theta: 0,
    };
  const t = days / 365,
    sd = iv * Math.sqrt(t),
    d1 = (Math.log(spot / c.strike) + (sd * sd) / 2) / sd;
  return {
    value:
      (value("call", c.strike, spot, days, iv) +
        value("put", c.strike, spot, days, iv)) *
      c.multiplier,
    delta: (2 * cdf(d1) - 1) * c.multiplier,
    gamma: ((2 * pdf(d1)) / (spot * sd)) * c.multiplier,
    vega: 2 * spot * pdf(d1) * Math.sqrt(t) * c.multiplier * 0.01,
    theta: (((-spot * pdf(d1) * iv) / Math.sqrt(t)) * c.multiplier) / 365,
  };
}
export function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state + 0.5) / 4294967296;
  };
}
export function makePath(kind = "roundtrip", seed = 42) {
  const rand = random(seed),
    prices = [100],
    ivs = [0.6];
  for (let i = 1; i <= 8; i++) {
    let s;
    if (kind === "roundtrip")
      s = [100, 105, 110, 105, 100, 94, 100, 107, 100][i];
    else if (kind === "quiet")
      s = 100 + (i === 8 ? 0 : Math.sin(i * 1.7) * 0.5);
    else if (kind === "jump") s = i < 4 ? 100 + i * 0.3 : 120 + (i - 4) * -1.5;
    else if (kind === "iv-fall") s = 100 + Math.sin(i * 1.4) * 3;
    else if (kind === "expiry") s = 100 + Math.sin(i * 1.1) * 2;
    else {
      const z =
        Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());
      s = Math.max(
        25,
        prices.at(-1) *
          Math.exp((-0.5 * 0.65 * 0.65) / 365 + (0.65 / Math.sqrt(365)) * z)
      );
    }
    prices.push(s);
    ivs.push(kind === "iv-fall" ? 0.6 - i * 0.035 : 0.6);
  }
  const start = kind === "expiry" ? 8 : 30;
  return prices.map((spot, i) => ({
    spot,
    iv: ivs[i],
    days: start - i,
    time: i,
  }));
}
export const SCENARIOS = [
  {
    id: "roundtrip",
    name: "相同终点，不同过程",
    label: "练习 01",
    description: "观察往返行情中 Delta 的改变，并与平静路径对照。",
    objective: "做出至少两次对冲决策，并观察方向暴露与成本。",
  },
  {
    id: "quiet",
    name: "时间经过，价格不动",
    label: "练习 02",
    description: "与第一关相同的起点和终点，时间价值却仍在流失。",
    objective: "识别时间价值变化；不把频繁操作当作完成条件。",
  },
  {
    id: "iv-fall",
    name: "波动率退潮",
    label: "练习 03",
    description: "价格温和变化，IV 从 60% 下降到 32%。",
    objective: "即使控制 Delta，仍然需要观察 Vega 风险。",
  },
  {
    id: "jump",
    name: "跳跃时刻",
    label: "练习 04",
    description: "相邻决策时刻之间发生价格跳跃。",
    objective: "区分当前中性与下一时刻暴露，观察近似归因残差。",
  },
  {
    id: "expiry",
    name: "靠近到期的转弯",
    label: "练习 05",
    description: "从剩余八天开始，最后一步到期现金结算。",
    objective: "观察 Gamma 的变化、现金结算和最终平仓。",
  },
  {
    id: "unknown",
    name: "未知行情挑战",
    label: "新种子挑战",
    description: "每次新挑战使用新种子，结束前隐藏未来路径。",
    objective: "在新路径中保持预先选定的风险规则。",
  },
];
export function startGame(kind = "roundtrip", seed = 42, config = {}) {
  if (!SCENARIOS.some(x => x.id === kind)) throw Error("Unknown scenario");
  const c = { ...CONFIG, ...config },
    path = makePath(kind, seed),
    first = path[0],
    premium = greeks(first.spot, first.days, first.iv, c).value;
  const entryCost = premium * c.feeRate;
  const cash = c.capital - premium - entryCost;
  return {
    rulesVersion: RULES_VERSION,
    kind,
    seed,
    c,
    path,
    index: 0,
    stock: 0,
    cash,
    initialOption: premium,
    optionCost: entryCost,
    stockFees: 0,
    spreadCost: 0,
    trades: [],
    decisions: [],
    history: [],
    complete: false,
    settlement: null,
  };
}
export function snapshot(state) {
  const m = state.path[state.index],
    g = greeks(m.spot, m.days, m.iv, state.c);
  if (state.complete)
    return {
      ...m,
      optionValue: 0,
      stock: 0,
      cash: state.cash,
      equity: state.cash,
      pnl: state.cash - state.c.capital,
      delta: 0,
      gamma: 0,
      vega: 0,
      theta: 0,
      cost: state.optionCost + state.stockFees + state.spreadCost,
    };
  const equity = state.cash + state.stock * m.spot + g.value;
  return {
    ...m,
    optionValue: g.value,
    stock: state.stock,
    cash: state.cash,
    equity,
    pnl: equity - state.c.capital,
    delta: state.stock + g.delta,
    gamma: g.gamma,
    vega: g.vega,
    theta: g.theta,
    cost: state.optionCost + state.stockFees + state.spreadCost,
  };
}
export function hedge(state, fraction = 1) {
  if (state.complete || state.index >= state.path.length - 1)
    throw Error("Session finished");
  if (![0, 0.5, 1].includes(fraction)) throw Error("Invalid hedge fraction");
  const before = snapshot(state),
    target = state.stock - before.delta * fraction;
  if (Math.abs(target) > state.c.maxStock)
    throw Error("Stock position limit exceeded");
  const qty = target - state.stock,
    fee = Math.abs(qty) * before.spot * state.c.feeRate,
    spread = Math.abs(qty) * before.spot * state.c.spreadRate;
  const after = {
    ...state,
    stock: target,
    cash: state.cash - qty * before.spot - fee - spread,
    stockFees: state.stockFees + fee,
    spreadCost: state.spreadCost + spread,
  };
  const trade = {
    time: before.time,
    spot: before.spot,
    qty,
    fee,
    spread,
    cashAfter: after.cash,
    stockAfter: target,
  };
  return {
    ...after,
    trades: Math.abs(qty) > 1e-10 ? [...state.trades, trade] : state.trades,
  };
}
export function decide(state, fraction = 0) {
  if (state.complete) throw Error("Session finished");
  if (state.decisions.some(d => d.index === state.index))
    throw Error("Decision already made for this turn");
  const next = hedge(state, fraction),
    obs = snapshot(next);
  return {
    ...next,
    decisions: [...state.decisions, { index: state.index, fraction, ...obs }],
  };
}
export function advance(state) {
  if (state.complete) throw Error("Session finished");
  const decision = state.decisions.find(d => d.index === state.index);
  if (!decision) throw Error("Choose a decision before advancing");
  const prev = snapshot(state),
    m = state.path[state.index + 1],
    g = greeks(prev.spot, prev.days, prev.iv, state.c),
    ds = m.spot - prev.spot,
    di = m.iv - prev.iv,
    dt = prev.days - m.days;
  let next = { ...state, index: state.index + 1 };
  const mark = snapshot(next),
    optionChange = mark.optionValue - prev.optionValue,
    stockChange = state.stock * ds;
  const approx = {
    direction: prev.delta * ds,
    gamma: 0.5 * g.gamma * ds * ds,
    theta: g.theta * dt,
    vega: g.vega * di * 100,
  };
  const residual =
    mark.equity -
    prev.equity -
    Object.values(approx).reduce((s, v) => s + v, 0);
  next.history = [
    ...state.history,
    {
      from: state.index,
      to: next.index,
      decision: decision.fraction,
      before: prev,
      after: mark,
      optionChange,
      stockChange,
      approx,
      residual,
    },
  ];
  return next.index === state.path.length - 1 ? settle(next) : next;
}
function settle(state) {
  const mark = snapshot(state),
    qty = -state.stock,
    fee = Math.abs(qty) * mark.spot * state.c.feeRate,
    spread = Math.abs(qty) * mark.spot * state.c.spreadRate;
  const exitFee = mark.days > 0 ? mark.optionValue * state.c.feeRate : 0;
  const cash =
    state.cash +
    state.stock * mark.spot +
    mark.optionValue -
    fee -
    spread -
    exitFee;
  const closing = {
    time: mark.time,
    spot: mark.spot,
    qty,
    fee,
    spread,
    cashAfter: state.cash + state.stock * mark.spot - fee - spread,
    stockAfter: 0,
    closing: true,
  };
  return {
    ...state,
    cash,
    stock: 0,
    stockFees: state.stockFees + fee,
    spreadCost: state.spreadCost + spread,
    optionCost: state.optionCost + exitFee,
    trades: Math.abs(qty) > 1e-10 ? [...state.trades, closing] : state.trades,
    complete: true,
    settlement: {
      optionValue: mark.optionValue,
      optionExitFee: exitFee,
      expiry: mark.days === 0,
      preCloseEquity: mark.equity,
    },
  };
}
export function runPolicy(kind, seed, policy, config = {}) {
  let s = startGame(kind, seed, config);
  while (!s.complete) {
    const d = Math.abs(snapshot(s).delta);
    const fraction =
      policy === "none"
        ? 0
        : policy === "timed"
          ? s.index % (s.c.interval || 2) === 0
            ? 1
            : 0
          : policy === "threshold"
            ? d > (s.c.threshold || 15)
              ? 1
              : 0
            : 1;
    s = advance(decide(s, fraction));
  }
  return s;
}
export function replayDecisions(kind, seed, decisions, config = {}) {
  let s = startGame(kind, seed, config);
  for (const f of decisions) {
    if (s.complete) throw Error("Too many decisions");
    s = advance(decide(s, f));
  }
  return s;
}
export function result(state) {
  const current = snapshot(state),
    terminal = state.complete
      ? state.settlement.optionValue
      : current.optionValue;
  const stockGross = state.history.reduce((sum, h) => sum + h.stockChange, 0);
  const optionGross = terminal - state.initialOption,
    cost = current.cost,
    pnl = optionGross + stockGross - cost;
  const exposures = state.history.map(h => Math.abs(h.before.delta)),
    maxDelta = Math.max(0, ...exposures);
  const equities = [
    state.c.capital,
    ...state.history.map(h => h.after.equity),
    current.equity,
  ];
  let peak = equities[0],
    drawdown = 0;
  for (const e of equities) {
    peak = Math.max(peak, e);
    drawdown = Math.max(drawdown, peak - e);
  }
  const within = exposures.filter(d => d <= (state.c.threshold || 15)).length;
  return {
    pnl,
    optionGross,
    stockGross,
    cost,
    fees: state.optionCost + state.stockFees,
    spread: state.spreadCost,
    maxDelta,
    drawdown,
    riskAdherence: exposures.length ? within / exposures.length : 0,
    turns: state.history.length,
    trades: state.trades.length,
    approx: state.history.reduce(
      (a, h) =>
        Object.fromEntries(Object.keys(a).map(k => [k, a[k] + h.approx[k]])),
      { direction: 0, gamma: 0, theta: 0, vega: 0 }
    ),
    residual: state.history.reduce((s, h) => s + h.residual, 0),
    reconciled: Math.abs(pnl - current.pnl) < 1e-7,
  };
}
