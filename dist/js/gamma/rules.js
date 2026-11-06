import { runPolicy, result, random } from "./engine.js";
export const DEFAULT_RULES = Object.freeze({
  threshold: 15,
  interval: 2,
  feeBps: 5,
  spreadBps: 5,
});
export function normalizeRules(raw = DEFAULT_RULES) {
  const keys = Object.keys(DEFAULT_RULES);
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Object.keys(raw).some(k => !keys.includes(k))
  )
    throw Error("对冲规则含未知字段");
  const r = { ...DEFAULT_RULES, ...raw };
  for (const [key, lo, hi] of [
    ["threshold", 1, 100],
    ["interval", 1, 4],
    ["feeBps", 0, 50],
    ["spreadBps", 0, 50],
  ])
    if (!Number.isFinite(r[key]) || r[key] < lo || r[key] > hi)
      throw Error(`${key} 须为 ${lo}–${hi}`);
  if (!Number.isInteger(r.interval)) throw Error("对冲间隔须为整数天");
  return r;
}
export const engineConfig = rules => {
  const r = normalizeRules(rules);
  return {
    threshold: r.threshold,
    interval: r.interval,
    feeRate: r.feeBps / 10000,
    spreadRate: r.spreadBps / 10000,
  };
};
export const QUESTIONS = {
  0: {
    text: "其他条件不变，标的小幅上涨后，这个多头跨式的期权 Delta 通常怎样变化？",
    choices: ["增加", "保持不变", "减少"],
    answer: 0,
    why: "多头跨式 Gamma 为正，价格上升会使期权 Delta 增加；旧的中性对冲不会一直中性。",
  },
  3: {
    text: "若标的价格不变、IV 单独下降，多头跨式的价值通常怎样变化？",
    choices: ["上升", "下降", "保持不变"],
    answer: 1,
    why: "Vega 为正。控制 Delta 仍不能消除 IV 下跌造成的估值损失。",
  },
  6: {
    text: "若价格与 IV 都不变，只经过一天，这个多头跨式的价值通常怎样变化？",
    choices: ["保持不变", "上升", "下降"],
    answer: 2,
    why: "Theta 通常为负。Gamma 收益需要行情变化，持有时间本身有代价。",
  },
};
export function predictionSummary(learning = {}) {
  const entries = Object.entries(learning.predictions || {}).filter(
    ([k, v]) => QUESTIONS[k] && Number.isInteger(v) && v >= 0 && v < 3
  );
  return {
    answered: entries.length,
    correct: entries.filter(([k, v]) => QUESTIONS[k].answer === v).length,
  };
}
export function seedBatch(seed, count = 32) {
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 4294967295 ||
    !Number.isInteger(count) ||
    count < 8 ||
    count > 128
  )
    throw Error("评估种子或样本数无效");
  const rng = random(seed),
    out = [];
  while (out.length < count) {
    const n = Math.floor(rng() * 4294967296);
    if (!out.includes(n)) out.push(n);
  }
  return out;
}
const quantile = (xs, q) => {
  const a = [...xs].sort((a, b) => a - b),
    i = (a.length - 1) * q;
  return a[Math.floor(i)] + (a[Math.ceil(i)] - a[Math.floor(i)]) * (i % 1);
};
export function summarize(rows) {
  const mean = key => rows.reduce((s, r) => s + r[key], 0) / rows.length;
  return {
    count: rows.length,
    p10: quantile(
      rows.map(r => r.pnl),
      0.1
    ),
    median: quantile(
      rows.map(r => r.pnl),
      0.5
    ),
    p90: quantile(
      rows.map(r => r.pnl),
      0.9
    ),
    meanPnl: mean("pnl"),
    meanCost: mean("cost"),
    meanDrawdown: mean("drawdown"),
    meanRisk: mean("riskAdherence"),
    worstDelta: Math.max(...rows.map(r => r.maxDelta)),
  };
}
export function evaluateRules(rules, seed, count = 32) {
  const r = normalizeRules(rules),
    seeds = seedBatch(seed, count),
    config = engineConfig(r);
  const policies = ["none", "timed", "threshold"].map(policy => {
    const rows = seeds.map(s =>
      result(runPolicy("unknown", s, policy, config))
    );
    if (rows.some(x => !x.reconciled)) throw Error("评估账本未对上");
    return { policy, stats: summarize(rows), rows };
  });
  const sensitivity = [0, 1, 2].map(scale => ({
    scale,
    stats: summarize(
      seeds.map(s =>
        result(
          runPolicy("unknown", s, "threshold", {
            ...config,
            feeRate: config.feeRate * scale,
            spreadRate: config.spreadRate * scale,
          })
        )
      )
    ),
  }));
  return { rules: r, seed, seeds, count, policies, sensitivity };
}
