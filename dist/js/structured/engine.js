import { value } from "../engine.js";
export const MARKET = Object.freeze({
  spot: 100,
  days: 30,
  iv: 0.4,
  optionUnitFee: 0.1,
});
export const CASES = [
  {
    id: "participation",
    name: "为底线，留出上涨空间",
    tag: "部分本金保护参与型",
    brief:
      "客户投入 $100，要求到期至少收到 $95，并获得至少 80% 的 $100 以上涨幅。先看本金底线和参与率能否同时放进预算。",
    requirements: [
      "到期底线 ≥ $95",
      "上涨参与率 ≥ 80%",
      "复制成本 + 执行费 ≤ $100",
    ],
    clarify:
      "保护只适用于到期支付；客户接受最多 5% 的本金损失，不需要提前退出。发行方履约是本模型假设，未消除真实信用风险。",
    risk: "95% 是部分本金保护，不是保本。参与收益要支付 Call 权利金，提前退出可能低于到期底线。",
    quiz: {
      text: "零利率下，预算 $100、到期保护 $100，再加正参与率，资金会怎样？",
      choices: [
        "自动产生免费收益",
        "还需要额外期权预算",
        "只要叫保本产品就能实现",
      ],
      answer: 1,
    },
    defaults: { floor: 100, participation: 1 },
    reference: { floor: 95, participation: 0.8 },
  },
  {
    id: "income",
    name: "票息，从哪里来？",
    tag: "无障碍到期收益增强",
    brief:
      "客户投入 $100，接受下跌风险，希望收到全期 3% 的票息；价格不低于 $100 时支付至少 $103。不能承诺无风险利息。",
    requirements: [
      "全期票息 ≥ 3%",
      "最坏到期支付 ≥ $3",
      "复制成本 + 执行费 ≤ $100",
    ],
    clarify:
      "3% 是这 30 天的全期票息，不是年化。只有到期观察，无障碍条款；客户接受标的下跌引起的大额损失。",
    risk: "票息资金来自卖出 Put 风险。标的跌至零时，3% 票息不能抵消本金损失；上涨收益封顶。",
    quiz: {
      text: "这笔高票息的主要资金来源是什么？",
      choices: [
        "卖出 Put、承担下跌风险",
        "发行方无条件赠送",
        "价格不动就没有风险",
      ],
      answer: 0,
    },
    defaults: { coupon: 8 },
    reference: { coupon: 3 },
  },
  {
    id: "collar",
    name: "为已有持仓，划一道边界",
    tag: "已有现货 · Collar",
    brief:
      "客户已经持有 1 单位价值 $100 的现货，不再投入现金。希望到期财富底线至少 $90，上涨封顶不低于 $110。",
    requirements: [
      "已有现货不重复买入",
      "额外现金投入 ≤ $0",
      "到期财富底线 ≥ $90、上限 ≥ $110",
    ],
    clarify:
      "现货所有权始终属于客户，初始财富为 $100，新增付款为零。接受卖出 Call 封顶，收到的净权利金留在客户账户。",
    risk: "卖 Call 为 Put 保护提供资金，也放弃高于执行价的上涨；这不是新投入 $100 的票据。",
    quiz: {
      text: "客户已有现货的 $100 应怎样记账？",
      choices: [
        "再收取客户 $100",
        "作为已有财富，新增付款为零",
        "当作发行方免费资产",
      ],
      answer: 1,
    },
    defaults: { putStrike: 95, callStrike: 120 },
    reference: { putStrike: 90, callStrike: 110 },
  },
];
export function getCase(id) {
  const c = CASES.find(x => x.id === id);
  if (!c) throw Error("未知客户任务");
  return c;
}
export function normalizeDesign(id, raw) {
  const c = getCase(id),
    keys = Object.keys(c.defaults);
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Object.keys(raw).some(k => !keys.includes(k))
  )
    throw Error("产品设计含未知字段");
  const out = {};
  for (const k of keys) {
    const [lo, hi] =
      k === "floor"
        ? [0, 100]
        : k === "participation"
          ? [0, 2]
          : k === "coupon"
            ? [0, 10]
            : k === "putStrike"
              ? [80, 100]
              : [100, 130];
    const n = raw[k];
    if (!Number.isFinite(n) || n < lo || n > hi)
      throw Error(`${k} 须为 ${lo}–${hi} 的有限数`);
    out[k] = n;
  }
  return out;
}
const option = (type, k) => value(type, k, 100, 30, 0.4);
export function evaluateDesign(id, raw, spot = 100) {
  const d = normalizeDesign(id, raw);
  if (!Number.isFinite(spot) || spot < 0 || spot > 2000)
    throw Error("情景价格无效");
  let legs,
    assetCost,
    fee,
    margin,
    payoff,
    customerPnl,
    issuerPnl,
    marketPnl,
    minPayoff,
    maxPayoff,
    checks,
    cash;
  if (id === "participation" || id === "income") {
    const isP = id === "participation",
      qty = isP ? d.participation : -1,
      type = isP ? "call" : "put";
    cash = isP ? d.floor : 100 + d.coupon;
    legs = [
      { type: "cash", qty: cash, strike: 0 },
      { type, qty, strike: 100 },
    ];
    assetCost = cash + qty * option(type, 100);
    fee = Math.abs(qty) * MARKET.optionUnitFee;
    margin = 100 - assetCost - fee;
    payoff =
      cash + qty * Math.max(type === "call" ? spot - 100 : 100 - spot, 0);
    customerPnl = payoff - 100;
    const assetTerminal = payoff;
    issuerPnl = margin + assetTerminal - payoff;
    marketPnl = assetCost - assetTerminal;
    minPayoff = isP ? cash : d.coupon;
    maxPayoff = isP ? (qty > 0 ? Infinity : cash) : cash;
    checks = isP
      ? [
          { label: "到期本金底线 ≥ $95", pass: d.floor >= 95, actual: cash },
          {
            label: "上涨参与率 ≥ 80%",
            pass: d.participation >= 0.8,
            actual: d.participation * 100,
          },
          {
            label: "预算 ≤ $100",
            pass: margin >= -1e-7,
            actual: assetCost + fee,
          },
        ]
      : [
          { label: "全期票息 ≥ 3%", pass: d.coupon >= 3, actual: d.coupon },
          { label: "最坏支付 ≥ $3", pass: minPayoff >= 3, actual: minPayoff },
          {
            label: "预算 ≤ $100",
            pass: margin >= -1e-7,
            actual: assetCost + fee,
          },
        ];
  } else {
    const p = option("put", d.putStrike),
      c = option("call", d.callStrike),
      net = p - c;
    fee = 0.2;
    cash = -net - fee;
    legs = [
      { type: "stock", qty: 1, strike: 0 },
      { type: "put", qty: 1, strike: d.putStrike },
      { type: "call", qty: -1, strike: d.callStrike },
      { type: "cash", qty: cash, strike: 0 },
    ];
    assetCost = net;
    margin = 0;
    payoff =
      spot +
      Math.max(d.putStrike - spot, 0) -
      Math.max(spot - d.callStrike, 0) +
      cash;
    customerPnl = payoff - 100;
    issuerPnl = 0;
    marketPnl = -customerPnl - fee;
    minPayoff = d.putStrike + cash;
    maxPayoff = d.callStrike + cash;
    checks = [
      {
        label: "不需要额外现金",
        pass: cash >= -1e-7,
        actual: Math.max(0, -cash),
      },
      {
        label: "到期财富底线 ≥ $90",
        pass: minPayoff >= 90 - 1e-7,
        actual: minPayoff,
      },
      {
        label: "到期财富上限 ≥ $110",
        pass: maxPayoff >= 110 - 1e-7,
        actual: maxPayoff,
      },
    ];
  }
  return {
    id,
    design: d,
    spot,
    legs,
    assetCost,
    fee,
    cash,
    margin,
    payoff,
    customerPnl,
    issuerPnl,
    marketPnl,
    minPayoff,
    maxPayoff,
    checks,
    pass: checks.every(x => x.pass),
    replicationError: 0,
    conservation: customerPnl + issuerPnl + marketPnl + fee,
  };
}
export function payment(id, d, s) {
  return evaluateDesign(id, d, s).payoff;
}
export function validateSubmission(
  id,
  design,
  { clarified, answer, explanation }
) {
  const c = getCase(id),
    r = evaluateDesign(id, design);
  if (!clarified) throw Error("先澄清客户信息，再提交设计。");
  if (answer !== c.quiz.answer)
    throw Error("资金来源或初始财富的解释需要修正，请重新阅读条款。");
  if (
    typeof explanation !== "string" ||
    explanation.trim().length < 8 ||
    explanation.length > 500
  )
    throw Error("请用 8–500 个字解释收益来源与一项风险。");
  if (!r.pass) throw Error("还有客户硬约束未通过，请调整设计。");
  return { ...r, explanation: explanation.trim() };
}
