const goal = (kind, limit, op = "lte", spot) => ({ kind, limit, op, spot });
export const LEVELS = [
  {
    id: "first-call",
    title: "给上涨一个机会",
    topic: "认识看涨期权",
    difficulty: "入门",
    time: "2 分钟",
    brief:
      "你看好未来 30 天的上涨，但不想承担持有现货的全部下跌风险。用一块期权积木，让上涨有空间、下跌有底线。",
    types: ["call"],
    strikes: [90, 100, 110],
    sell: false,
    maxUnits: 1,
    goals: [
      goal("debit", 6),
      goal("loss", 6),
      goal("scenario", 10, "gte", 120),
    ],
    hint: "买入看涨期权的最大损失是权利金与费用。比较不同执行价：价格越低的 Call，一般越贵。",
    lesson:
      "买入 Call 用确定的初始成本换取上涨空间。方向看对仍不一定赚钱：标的必须跨过执行价与建仓成本之和。",
    solution: [{ type: "call", strike: 100, qty: 1 }],
    concept: "有限风险 · 上涨参与",
  },
  {
    id: "bull-spread",
    title: "用取舍换预算",
    topic: "牛市看涨价差",
    difficulty: "入门",
    time: "3 分钟",
    brief:
      "预算收紧到 $3.60。你仍希望上涨到 $120 时至少赚 $6。试着卖出一部分更远处的上涨空间，为你的组合减负。",
    types: ["call"],
    strikes: [90, 100, 110],
    sell: true,
    maxUnits: 2,
    goals: [
      goal("debit", 3.6),
      goal("loss", 3.6),
      goal("scenario", 6, "gte", 120),
    ],
    hint: "保留较低执行价的多头 Call，再卖出较高执行价的 Call。收到的权利金能减少成本，也会限制最高收益。",
    lesson:
      "牛市价差降低了建仓成本和最大损失，代价是上涨收益封顶。两条腿必须具有相同数量和到期日。",
    solution: [
      { type: "call", strike: 100, qty: 1 },
      { type: "call", strike: 110, qty: -1 },
    ],
    concept: "降低成本 · 收益封顶",
  },
  {
    id: "protective-put",
    title: "给持仓系上安全带",
    topic: "保护性看跌",
    difficulty: "基础",
    time: "3 分钟",
    brief:
      "搭建一份现货持仓，再为它购买下跌保险。无论标的跌到哪里，损失都要控制在 $12 以内，同时保留上涨收益。",
    types: ["stock", "put"],
    strikes: [90, 100, 110],
    sell: false,
    maxUnits: 2,
    goals: [
      goal("debit", 102),
      goal("loss", 12),
      goal("scenario", 17, "gte", 120),
    ],
    hint: "现货提供上涨参与，Put 在标的跌破执行价时提供保护。试试 K=90 的看跌期权，观察曲线左边如何被托住。",
    lesson:
      "现货加保护性 Put 能建立下行底线。保险并非免费：权利金会增加建仓成本，也会提高盈亏平衡点。",
    solution: [
      { type: "stock", strike: 0, qty: 1 },
      { type: "put", strike: 90, qty: 1 },
    ],
    concept: "持有现货 · 管理下行",
  },
  {
    id: "straddle",
    title: "方向未知，波动可期",
    topic: "买入跨式",
    difficulty: "基础",
    time: "4 分钟",
    brief:
      "重大事件即将发生，你无法判断方向，却预计价格会大幅移动。让 $80 与 $120 两个到期情景都能盈利至少 $10。",
    types: ["call", "put"],
    strikes: [90, 100, 110],
    sell: false,
    maxUnits: 2,
    goals: [
      goal("debit", 10),
      goal("loss", 10),
      goal("scenario", 10, "gte", 80),
      goal("scenario", 10, "gte", 120),
    ],
    hint: "把同一执行价的 Call 和 Put 放在一起。两边的上涨机会要付两份权利金；如果价格不动，时间价值会流失。",
    lesson:
      "买入跨式押注足够大的价格变动。在本关的到期情景里，价格需要越过两侧盈亏平衡点；到期前还会受隐含波动率与时间影响。",
    solution: [
      { type: "call", strike: 100, qty: 1 },
      { type: "put", strike: 100, qty: 1 },
    ],
    concept: "双向机会 · 双份成本",
  },
  {
    id: "butterfly",
    title: "把收益留在中间",
    topic: "看涨蝶式",
    difficulty: "进阶",
    time: "5 分钟",
    brief:
      "你预计到期价格会停留在 $100 附近。拼出一座收益小山：中间盈利至少 $5.50，两侧的风险受到限制。",
    types: ["call"],
    strikes: [90, 100, 110],
    sell: true,
    maxUnits: 4,
    goals: [
      goal("debit", 5),
      goal("loss", 5),
      goal("scenario", 5.5, "gte", 100),
      goal("scenario", -5, "gte", 80),
      goal("scenario", -5, "gte", 120),
    ],
    hint: "经典对称蝶式的数量是 1 : −2 : 1。两侧买入 Call，中间卖出两份 Call，把收益集中在中间执行价附近。",
    lesson:
      "蝶式用有限成本表达区间观点。到期价格越接近中间执行价，收益越高；越过两翼后，损失被初始净成本限制。",
    solution: [
      { type: "call", strike: 90, qty: 1 },
      { type: "call", strike: 100, qty: -2 },
      { type: "call", strike: 110, qty: 1 },
    ],
    concept: "区间判断 · 收益塑形",
  },
  {
    id: "collar",
    title: "为风险划一道边界",
    topic: "领口组合",
    difficulty: "进阶",
    time: "5 分钟",
    brief:
      "你希望持有现货，同时给下跌设底线。用卖出部分上涨空间的收入补贴保护成本，在预算内完成最后的组合。",
    types: ["stock", "call", "put"],
    strikes: [90, 100, 110],
    sell: true,
    maxUnits: 3,
    goals: [
      goal("debit", 101),
      goal("loss", 11),
      goal("scenario", 9, "gte", 120),
    ],
    hint: "现货 + 买入较低执行价 Put + 卖出较高执行价 Call。想想为什么这条曲线两边都是平的。",
    lesson:
      "领口组合把现货的上下行同时限制。卖出 Call 可补贴 Put 的成本，但不存在“保留全部上涨又免费保护”的保证。",
    solution: [
      { type: "stock", strike: 0, qty: 1 },
      { type: "put", strike: 90, qty: 1 },
      { type: "call", strike: 110, qty: -1 },
    ],
    concept: "成本权衡 · 双侧边界",
  },
];
export const SANDBOX = {
  id: "sandbox",
  title: "你的策略实验室",
  topic: "自由实验",
  types: ["call", "put", "stock", "cash"],
  strikes: [80, 90, 100, 110, 120],
  sell: true,
  maxUnits: 8,
  goals: [],
};
export const goalLabel = g =>
  g.kind === "debit"
    ? `初始净支出 ≤ $${g.limit.toFixed(2)}`
    : g.kind === "loss"
      ? `最大损失 ≤ $${g.limit.toFixed(2)}`
      : `到期价 $${g.spot} 时，损益 ≥ ${g.limit < 0 ? "−" : ""}$${Math.abs(g.limit).toFixed(2)}`;
