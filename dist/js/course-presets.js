import { MARKET } from "./engine.js";
export const STARTER_PACK = {
  format: "arcade-course",
  version: 1,
  id: "custom-structure-lab",
  title: "结构与取舍 · 三道任务",
  lessons: [
    {
      id: "custom-budget-spread",
      title: "有限预算的上涨",
      topic: "预算与风险",
      brief: "在 $3.60 预算内，构建上涨到 $120 时至少盈利 $6 的组合。",
      types: ["call"],
      strikes: [90, 100, 110],
      sell: true,
      maxUnits: 2,
      market: { ...MARKET },
      goals: [
        { kind: "debit", limit: 3.6, op: "lte" },
        { kind: "loss", limit: 3.6, op: "lte" },
        { kind: "scenario", spot: 120, limit: 6, op: "gte" },
      ],
      solution: [
        { type: "call", strike: 100, qty: 1 },
        { type: "call", strike: 110, qty: -1 },
      ],
      hint: "想想较高执行价 Call 的空头会抵销什么。",
      lesson: "降低成本需要付出上涨收益封顶的代价。",
    },
    {
      id: "custom-synthetic-stock",
      title: "同样支付，另一种配方",
      topic: "现金腿与合成现货",
      brief:
        "初始价为 $40，只用 Call、Put 与每块 $10 的现金，复制现货的到期支付。支付须在 $0 与 $40 处相等，右端斜率须为 1。工具只有 K40，因此这些折点与斜率覆盖完整价格区间。净盈亏仍需扣除组合成本与费用。",
      types: ["call", "put", "cash"],
      strikes: [40],
      sell: true,
      maxUnits: 6,
      market: { ...MARKET, spot: 40 },
      goals: [
        { kind: "payoff", spot: 0, limit: 0, op: "gte" },
        { kind: "payoff", spot: 0, limit: 0, op: "lte" },
        { kind: "payoff", spot: 40, limit: 40, op: "gte" },
        { kind: "payoff", spot: 40, limit: 40, op: "lte" },
        { kind: "tailSlope", limit: 1, op: "gte" },
        { kind: "tailSlope", limit: 1, op: "lte" },
      ],
      solution: [
        { type: "call", strike: 40, qty: 1 },
        { type: "put", strike: 40, qty: -1 },
        { type: "cash", strike: 0, qty: 4 },
      ],
      hint: "Call − Put 的到期支付是 S − K，还需要补上多少现金？",
      lesson:
        "Call − Put + K 的到期支付等于现货。在零利率模型中价格也满足平价，但不同组合的单位费用可能不同。",
    },
    {
      id: "custom-impossible-order",
      title: "不可能的订单",
      topic: "识别约束冲突",
      brief:
        "只允许买入最多一份 K100 Call；要求初始支出不超过 $1，且到期价 $120 时盈利至少 $10。你可以尝试构建，也可以提交“当前条件无解”并查看完整枚举证明。",
      types: ["call"],
      strikes: [100],
      sell: false,
      maxUnits: 1,
      market: { ...MARKET },
      goals: [
        { kind: "debit", limit: 1, op: "lte" },
        { kind: "scenario", spot: 120, limit: 10, op: "gte" },
      ],
      infeasible: true,
      hint: "当前牌库只有两种选择：不持有，或买入一份 Call。逐一检查就可以证明。",
      lesson:
        "无解仅指本题给定的工具、整数数量与上限；它不是对所有可能的金融合约作出的断言。",
    },
  ],
};
