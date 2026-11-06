import { MARKET } from "./engine.js";
export const TRANSFERS = [
  {
    id: "transfer-shift",
    concept: "价格尺度 · 重新核算",
    title: "换一个起点，重新搭建",
    topic: "迁移 01 · 新的执行价",
    difficulty: "迁移",
    time: "4 分钟",
    brief:
      "标的初始价格变成 $110。用 K110 与 K120 的 Call，在新预算下保留有限的上涨收益。这里没有目标轮廓和示范解。",
    types: ["call"],
    strikes: [100, 110, 120],
    sell: true,
    maxUnits: 2,
    market: { ...MARKET, spot: 110 },
    goals: [
      { kind: "debit", limit: 4, op: "lte" },
      { kind: "loss", limit: 4, op: "lte" },
      { kind: "scenario", spot: 130, limit: 6, op: "gte" },
    ],
    hint: "把执行价相对初始价格的位置作为参照。试着用较高执行价的空头 Call 补贴多头成本。",
    lesson:
      "同一种结构可以迁移到不同价格尺度，但权利金、预算和盈亏平衡点仍需重新核算。",
    solution: [
      { type: "call", strike: 110, qty: 1 },
      { type: "call", strike: 120, qty: -1 },
    ],
  },
  {
    id: "transfer-cost",
    concept: "费用增加 · 净收益减少",
    title: "当每一块积木都变贵",
    topic: "迁移 02 · 交易成本",
    difficulty: "迁移",
    time: "4 分钟",
    brief:
      "每单位建仓费从 $0.10 提高到 $1.00。用不超过两单位的组合，把支出和最大损失控制在 $5.50，并在 $120 时至少赚 $4.50。",
    types: ["call"],
    strikes: [90, 100, 110],
    sell: true,
    maxUnits: 2,
    market: { ...MARKET, fee: 1 },
    goals: [
      { kind: "debit", limit: 5.5, op: "lte" },
      { kind: "loss", limit: 5.5, op: "lte" },
      { kind: "scenario", spot: 120, limit: 4.5, op: "gte" },
    ],
    hint: "结构形状没有因费用改变，但整条净损益曲线向下移动了。比较建仓费总额与净权利金。",
    lesson:
      "即使期权报价相同，更高费用也会增加损失并减少收益。这里费用按最终净持仓单位收取，不是回放中的点击次数。",
    solution: [
      { type: "call", strike: 100, qty: 1 },
      { type: "call", strike: 110, qty: -1 },
    ],
  },
  {
    id: "transfer-vol",
    concept: "波动率更贵 · 变动需更大",
    title: "贵一些的波动，够不够远",
    topic: "迁移 03 · 波动率与成本",
    difficulty: "迁移",
    time: "5 分钟",
    brief:
      "建仓 IV 提高到 50%，每单位费用为 $0.20。用 Call 和 Put，争取在 $75 与 $125 两个到期情景都至少盈利 $12。",
    types: ["call", "put"],
    strikes: [95, 100, 105],
    sell: false,
    maxUnits: 2,
    market: { ...MARKET, vol: 0.5, fee: 0.2 },
    goals: [
      { kind: "debit", limit: 12, op: "lte" },
      { kind: "loss", limit: 12, op: "lte" },
      { kind: "scenario", spot: 75, limit: 12, op: "gte" },
      { kind: "scenario", spot: 125, limit: 12, op: "gte" },
    ],
    hint: "买入同执行价 Call 与 Put 能让两边都有机会。但建仓 IV 更高意味着权利金更贵，需要更大的价格变动。",
    lesson:
      "更高的建仓 IV 会提高买入期权的成本。方向无关的结构，也必须有足够大的到期变动才能覆盖成本。",
    solution: [
      { type: "call", strike: 100, qty: 1 },
      { type: "put", strike: 100, qty: 1 },
    ],
  },
];
export const PREDICTIONS = {
  "first-call": {
    question: "买入一份 Call 后，如果到期价格等于执行价，会发生什么？",
    choices: [
      "既没有收益，也没有损失",
      "期权到期价值为零，但仍损失权利金和费用",
      "自动赚取权利金",
    ],
    answer: 1,
    explanation:
      "内在价值为零不等于净损益为零。已经支付的权利金与建仓费仍需要扣除。",
  },
  "bull-spread": {
    question: "在买入 K100 Call 的同时，卖出 K110 Call，会怎样改变组合？",
    choices: [
      "降低成本，同时让上涨收益封顶",
      "降低成本，并保留全部上涨收益",
      "提高成本，同时消除所有风险",
    ],
    answer: 0,
    explanation:
      "卖出较高执行价的 Call 收到权利金；标的超过 K110 后，两条腿的斜率相互抵销，因此收益封顶。",
  },
  "protective-put": {
    question: "现货加上买入 Put，主要改变了什么？",
    choices: [
      "消除了所有损失，且不花钱",
      "提高了现货的上涨斜率",
      "付出保险成本，为到期下跌设定底线",
    ],
    answer: 2,
    explanation:
      "Put 的内在价值在标的下跌时增加，抵销现货继续下跌的损失，但保险权利金会增加初始成本。",
  },
  straddle: {
    question: "同时买入同执行价 Call 和 Put，是否只要价格有变化就能盈利？",
    choices: [
      "是，两个方向都能赚钱",
      "否，变动必须足够大才能覆盖两份成本",
      "是，只要到期价格不等于执行价",
    ],
    answer: 1,
    explanation:
      "两条腿都要支付权利金，净损益需要跨过两侧盈亏平衡点。微小变动未必覆盖成本。",
  },
  butterfly: {
    question: "对称买入蝶式的到期收益，通常在哪个位置最高？",
    choices: ["中间执行价附近", "价格涨得越高越好", "价格跌到零时"],
    answer: 0,
    explanation:
      "1 : −2 : 1 的看涨蝶式让曲线在中间形成顶点，越过两翼后收益不再随价格变化。",
  },
  collar: {
    question: "卖出高执行价 Call 补贴 Put 保险，付出的代价是什么？",
    choices: ["最大损失变成无限", "放弃部分上涨空间", "必须放弃所有现货持仓"],
    answer: 1,
    explanation:
      "领口用 Call 空头的权利金补贴下跌保险，上涨超过 Call 执行价后的收益因此受到限制。",
  },
};
const copy = legs => legs.map(l => ({ ...l }));
export const newTimeline = legs => ({
  cursor: 0,
  steps: [{ label: "本次起点", legs: copy(legs) }],
});
export function recordStep(t, legs, label) {
  const steps = t.steps.slice(0, t.cursor + 1);
  if (JSON.stringify(steps.at(-1).legs) === JSON.stringify(legs)) return t;
  steps.push({ label, legs: copy(legs) });
  if (steps.length > 50) steps.shift();
  return { cursor: steps.length - 1, steps };
}
export function moveStep(t, offset) {
  return {
    ...t,
    cursor: Math.max(0, Math.min(t.steps.length - 1, t.cursor + offset)),
  };
}
export function restoreTimeline(raw, legs, validate) {
  if (
    !raw ||
    !Array.isArray(raw.steps) ||
    raw.steps.length < 1 ||
    raw.steps.length > 50 ||
    !Number.isInteger(raw.cursor) ||
    raw.cursor < 0 ||
    raw.cursor >= raw.steps.length
  )
    return newTimeline(legs);
  const steps = raw.steps.map(s => ({
    label: typeof s?.label === "string" ? s.label.slice(0, 60) : "调整组合",
    legs: validate(s?.legs),
  }));
  if (
    raw.steps.some(
      (s, i) =>
        !Array.isArray(s?.legs) ||
        JSON.stringify(steps[i].legs) !== JSON.stringify(s.legs)
    )
  )
    return newTimeline(legs);
  if (JSON.stringify(steps[raw.cursor].legs) !== JSON.stringify(legs))
    return newTimeline(legs);
  return { cursor: raw.cursor, steps };
}
export function predictionResult(id, index) {
  const q = PREDICTIONS[id];
  return q && Number.isInteger(index) && index >= 0 && index < q.choices.length
    ? { choice: index, correct: index === q.answer }
    : null;
}
