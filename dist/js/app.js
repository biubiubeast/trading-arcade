import {
  MARKET,
  quote as engineQuote,
  pnl as enginePnl,
  analyze as engineAnalyze,
  mergeLeg,
  units,
  checkLevel,
} from "./engine.js";
import { LEVELS, SANDBOX, goalLabel } from "./levels.js";
import {
  TRANSFERS,
  PREDICTIONS,
  newTimeline,
  recordStep,
  moveStep,
  restoreTimeline,
  predictionResult,
} from "./learning.js";
import { comparisonPlot } from "./core/comparison.js";
import { shell as appShell } from "./core/shell.js";
import { routeFromHash, createRouter } from "./core/navigation.js";
import { createStructuredGame } from "./structured/view.js";
import { createGammaGame } from "./gamma/view.js";
import { createContentUI, runtimeCourse } from "./course-ui.js";
import { normalizePack, portablePack, enumerate } from "./content.js";
import { GAMES } from "./games.js";
import { readProgress, saveProgress, validDraft } from "./storage.js";

import { icon, money, signed, typeName, legName } from "./ui.js";
const progress = readProgress();
let coursePack = null;
try {
  if (progress.customCourse) coursePack = normalizePack(progress.customCourse);
} catch {}
let courseLessons = coursePack ? runtimeCourse(coursePack) : [];
let courseIndex = Math.min(
  progress.lastCourse || 0,
  Math.max(0, courseLessons.length - 1)
);
let route = routeFromHash(location.hash),
  levelIndex = progress.lastLevel,
  transferIndex = progress.lastTransfer,
  mode =
    progress.lastMode === "course" && !courseLessons.length
      ? "challenge"
      : progress.lastMode,
  legs = [],
  libraryType = "call",
  side = 1,
  chartMode = "expiry",
  days = 15,
  vol = 40,
  scenario = 110,
  showTarget = true,
  storageWarning = false;
let hints = progress.hintUse,
  modalReturn = null,
  timeline,
  replayIndex = 0,
  pendingAdd = null;
const app = document.querySelector("#app");
const current = () =>
  mode === "sandbox"
    ? SANDBOX
    : mode === "transfer"
      ? TRANSFERS[transferIndex]
      : mode === "course"
        ? courseLessons[courseIndex]
        : LEVELS[levelIndex];
const market = () => current().market || MARKET;
const quote = l => engineQuote(l, market());
const pnl = (ls, spot, t = 0, v) => enginePnl(ls, spot, t, v, market());
const analyze = ls => engineAnalyze(ls, market());
const activeLevels = () =>
  mode === "transfer" ? TRANSFERS : mode === "course" ? courseLessons : LEVELS;
const activeIndex = () =>
  mode === "transfer"
    ? transferIndex
    : mode === "course"
      ? courseIndex
      : levelIndex;
const completed = () =>
  LEVELS.filter(l => progress.completed[l.id]?.stars > 0).length;
const totalStars = () =>
  LEVELS.reduce((s, l) => s + (progress.completed[l.id]?.stars || 0), 0);
function restore() {
  legs = validDraft(progress.drafts[current().id], current());
  timeline = restoreTimeline(progress.sessions[current().id], legs, x =>
    validDraft(x, current())
  );
  vol = Math.round(market().vol * 100);
  scenario = market().spot + 10;
  days = Math.min(15, market().days);
  if (!current().types.includes(libraryType)) libraryType = current().types[0];
  if (!current().sell) side = 1;
}
restore();
function persist() {
  progress.drafts[current().id] = legs;
  progress.sessions[current().id] = timeline;
  progress.lastLevel = levelIndex;
  progress.lastTransfer = transferIndex;
  progress.lastMode = mode;
  progress.lastCourse = courseIndex;
  progress.customCourse = coursePack ? portablePack(coursePack) : null;
  if (!saveProgress(progress) && !storageWarning) {
    storageWarning = true;
    toast("浏览器存储不可用，本次进度仅保留到页面关闭。");
  }
}
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("visible"), 3300);
}
function navTo(next) {
  if (location.hash.slice(1) === next) {
    route = next;
    render();
  } else location.hash = next;
}
window.addEventListener("hashchange", () => {
  route = routeFromHash(location.hash);
  closeModal();
  render();
  window.scrollTo(0, 0);
  if (route === "share") contentUI.previewShare(location.hash.slice(7));
});

const gammaGame = createGammaGame({ openModal, closeModal, toast });
const structuredGame = createStructuredGame({ openModal, closeModal, toast });
const gameRouter = createRouter(id =>
  id === "gamma"
    ? gammaGame
    : id === "structured"
      ? structuredGame
      : { mount() {}, unmount() {} }
);
const contentUI = createContentUI({
  progress,
  refresh: render,
  builtins: [...LEVELS, ...TRANSFERS],
  getCourse: () => coursePack,
  getWorkspace: () => ({ level: current(), legs, market: market() }),
  applyPack: (pack, sharedLegs) => {
    persist();
    coursePack = pack;
    courseLessons = runtimeCourse(pack);
    courseIndex = 0;
    mode = "course";
    restore();
    if (sharedLegs) {
      legs = sharedLegs;
      timeline = newTimeline(legs);
      hints[current().id] = 2;
    }
    persist();
    navTo("play");
  },
  openCourse: i => {
    persist();
    mode = "course";
    courseIndex = Math.max(0, Math.min(courseLessons.length - 1, i));
    restore();
    persist();
    navTo("play");
  },
  applyProgress: next => {
    Object.assign(progress, next);
    hints = progress.hintUse;
    restore();
    persist();
    render();
    toast("学习记录已合并。");
  },
  openModal,
  closeModal,
  toast,
});
function shell() {
  return appShell({
    route,
    completed: completed(),
    main: ["gamma", "structured"].includes(route)
      ? '<div id="game-root"></div>'
      : route === "courses"
        ? contentUI.view()
        : route === "games"
          ? gamesView()
          : route === "learn"
            ? learnView()
            : route === "progress"
              ? progressView()
              : route === "roadmap"
                ? roadmapView()
                : playView(),
  });
}
function render() {
  document.title =
    (route === "structured"
      ? "结构化产品工坊"
      : route === "gamma"
        ? "波动率捕手"
        : route === "courses"
          ? "课程工坊"
          : "期权积木") + " · 交易游乐场";
  const active = document.activeElement;
  const key = active?.dataset?.action ? { ...active.dataset } : null;
  app.innerHTML = shell();
  gameRouter.mount(
    ["gamma", "structured"].includes(route) ? route : "static",
    document.querySelector("#game-root") || document.querySelector("#main")
  );
  bindChart();
  if (key) {
    const candidate = [...app.querySelectorAll("[data-action]")].find(el =>
      Object.entries(key).every(([k, v]) => el.dataset[k] === v)
    );
    candidate?.focus({ preventScroll: true });
  }
}
function pageHeading(eyebrow, title, desc, extra = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div>${extra}</div>`;
}
function learningBar() {
  const q = PREDICTIONS[current().id],
    r = progress.predictions[current().id],
    baseline = validDraft(progress.comparisons[current().id], current());
  return `<section class="learning-toolbar" aria-label="学习与实验工具"><div class="learning-prompt">${icon(mode === "transfer" ? "target" : "bulb", 18)}<span>${mode === "transfer" ? "迁移挑战 · 无目标轮廓、无示范解" : q ? (r ? "已记录首次预测 · 理解与通关分别记录" : "先预测，再动手 · 把直觉放到实验里验证") : mode === "course" ? "课程任务 · 按当前市场与约束验收" : "自由构建 · 保存一个组合，再比较不同选择"}</span>${q ? `<button class="text-button" data-action="predict">${r ? "查看预测" : "回答预测"} ${icon("arrow", 14)}</button>` : ""}</div><div class="experiment-actions"><button data-action="undo" ${timeline.cursor === 0 ? "disabled" : ""}>撤销</button><button data-action="redo" ${timeline.cursor === timeline.steps.length - 1 ? "disabled" : ""}>重做</button><button data-action="replay">操作回放 <small>${timeline.steps.length - 1}</small></button><button data-action="pin" ${!legs.length ? "disabled" : ""}>保存对照</button><button data-action="compare" ${!baseline.length ? "disabled" : ""}>比较组合</button><button data-content="share" ${!legs.length ? "disabled" : ""}>分享组合</button><a class="text-button" href="#courses">课程工坊 ${icon("arrow", 13)}</a></div></section>`;
}
function predict() {
  const q = PREDICTIONS[current().id];
  if (!q) return;
  const stored = progress.predictions[current().id];
  if (stored) {
    predictionFeedback(q, predictionResult(current().id, stored.choice));
    return;
  }
  openModal(
    "先预测，再验证",
    `<span class="eyebrow">CONCEPT CHECK · ${escapeText(current().topic)}</span><p class="modal-lead">${q.question}</p><div class="prediction-options">${q.choices.map((c, i) => `<button data-action="answer" data-index="${i}"><b>${String.fromCharCode(65 + i)}</b><span>${c}</span></button>`).join("")}</div><p class="muted">首次判断单独保存，不影响组合星级。答错也可以继续，用实际曲线检验你的理解。</p>`
  );
}
function answerPrediction(index) {
  const q = PREDICTIONS[current().id],
    r = predictionResult(current().id, index);
  if (!r || progress.predictions[current().id]) return;
  progress.predictions[current().id] = { choice: index };
  persist();
  render();
  predictionFeedback(q, r);
}
function predictionFeedback(q, r) {
  openModal(
    r.correct ? "这个直觉，接下来亲手验证。" : "发现一个值得验证的区别。",
    `<p class="modal-lead">${q.question}</p><div class="prediction-result"><p>你的首次判断：<b>${q.choices[r.choice]}</b></p><p class="positive">正确理解：${q.choices[q.answer]}</p></div><div class="callout">${icon("bulb", 19)}<p>${q.explanation}</p></div><p class="muted">概念判断与组合星级分别记录。重复查看不会改变首次答案。</p><button class="primary-button" data-action="resumeadd">用曲线验证 ${icon("arrow", 16)}</button>`
  );
}
function predictionProgress() {
  const answers = LEVELS.map(l =>
      predictionResult(l.id, progress.predictions[l.id]?.choice)
    ).filter(Boolean),
    transfers = TRANSFERS.filter(l => progress.completed[l.id]).length;
  return `<section class="panel explain-panel"><h2>理解与操作，分开观察</h2><div class="understanding-stats"><div><b>${answers.length}/6</b><span>已回答概念预测</span></div><div><b>${answers.filter(r => r.correct).length}/${answers.length}</b><span>首次预测正确</span></div><div><b>${transfers}/3</b><span>迁移挑战完成</span></div></div><p class="muted">基础关星星只反映本游戏任务完成情况；概念预测和无轮廓迁移题提供另外两种观察。它们尚不是经过验证的能力测评。</p></section>`;
}
function travel(offset) {
  timeline = moveStep(timeline, offset);
  legs = timeline.steps[timeline.cursor].legs.map(l => ({ ...l }));
  persist();
  render();
}
function replay() {
  replayIndex = Math.max(0, Math.min(timeline.steps.length - 1, replayIndex));
  const step = timeline.steps[replayIndex],
    a = analyze(step.legs);
  openModal(
    "回看你的选择",
    `<p class="modal-lead">第 ${replayIndex} 步 · ${escapeText(step.label)}</p><p class="muted">只读回放，不改变当前组合。保留最近 50 个状态；撤销后修改会产生新的操作分支。</p><div class="replay-track">${timeline.steps.map((_, i) => `<button data-action="replaystep" data-index="${i}" class="${i === replayIndex ? "selected" : ""}" aria-label="查看第 ${i} 步">${i}</button>`).join("")}</div><div class="replay-legs">${step.legs.length ? step.legs.map(l => `<span class="pill">${l.qty > 0 ? "买入" : "卖出"} ${Math.abs(l.qty)} ${legName(l)}</span>`).join("") : '<span class="muted">空组合</span>'}</div><div class="report-summary"><span>初始净支出<b>${money(a.debit)}</b></span><span>最大损失<b>${money(a.maxLoss)}</b></span><span>S=${market().spot + 20} 时损益<b>${signed(pnl(step.legs, market().spot + 20))}</b></span></div><div class="modal-actions"><button class="outline-button" data-action="replaystep" data-index="${replayIndex - 1}" ${replayIndex === 0 ? "disabled" : ""}>上一步</button><button class="primary-button" data-action="replaystep" data-index="${replayIndex + 1}" ${replayIndex === timeline.steps.length - 1 ? "disabled" : ""}>下一步 ${icon("arrow", 16)}</button></div>`
  );
}
function compare() {
  const saved = validDraft(progress.comparisons[current().id], current());
  if (!saved.length) {
    toast("先保存一个组合为对照。");
    return;
  }
  const old = analyze(saved),
    now = analyze(legs);
  openModal(
    "比较两种选择",
    `<p class="modal-lead">在同一关、同一组建仓参数下比较，看看你改变了什么。</p>${comparisonPlot(saved, legs, market())}<div class="comparison-legs"><div><b>已保存的对照</b><p>${saved.map(l => `${l.qty > 0 ? "+" : ""}${l.qty} ${legName(l)}`).join(" / ")}</p></div><div><b>当前组合</b><p>${legs.length ? legs.map(l => `${l.qty > 0 ? "+" : ""}${l.qty} ${legName(l)}`).join(" / ") : "空组合"}</p></div></div><div class="scenario-table"><div><span>指标</span><span>对照</span><span>当前</span></div>${[["初始净支出", old.debit, now.debit], ["最大收益", old.maxProfit, now.maxProfit], ["最大损失", old.maxLoss, now.maxLoss], ...[market().spot - 20, market().spot, market().spot + 20].map(s => [`S=${s} 损益`, pnl(saved, s), pnl(legs, s)])].map(([name, a, b]) => `<div><span>${name}</span><b>${money(a)}</b><b>${money(b)}</b></div>`).join("")}</div><div class="callout">${icon("bulb", 18)}<p>成本减少了吗？收益有没有封顶？不要只看一个价格情景。这里比较的是静态组合，不是实际交易流水。</p></div>`,
    true
  );
}
function escapeText(s) {
  return String(s).replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]
  );
}

function playView() {
  const level = current();
  const a = analyze(legs);
  const result = mode !== "sandbox" ? checkLevel(level, legs) : null;
  return `${pageHeading("GAME 01 / PAYOFF PUZZLE", `期权积木<span class="title-tag">${icon("blocks", 13)} 收益曲线解谜</span>`, "把交易观点变成一条曲线。拼一拼，理解每一份收益与风险。", `<button class="outline-button" data-action="guide">${icon("help", 16)}怎么玩</button>`)}<div class="workspace-bar"><div class="segmented mode-tabs"><button data-action="mode" data-mode="challenge" class="${mode === "challenge" ? "selected" : ""}">${icon("flag", 16)}关卡挑战</button><button data-action="mode" data-mode="sandbox" class="${mode === "sandbox" ? "selected" : ""}">${icon("spark", 16)}自由实验</button><button data-action="mode" data-mode="transfer" class="${mode === "transfer" ? "selected" : ""}">${icon("target", 16)}迁移挑战</button></div><span class="session-note">${icon("clock", 14)} ${mode !== "sandbox" ? "一关约 " + level.time : "没有标准答案，尽情试一试"}</span><button class="text-button reset-button" data-action="reset">${icon("reset", 15)}重置组合</button></div>${learningBar()}<div class="play-grid"><section class="mission panel">${missionView(level, result)}</section><section class="chart-panel panel"><div class="panel-heading"><div><h2>${icon("activity", 18)}${chartMode === "payoff" ? "到期支付曲线" : chartMode === "expiry" ? "到期损益曲线" : "到期前估值曲线"}</h2><p>看看你的组合，在不同价格下会发生什么。</p></div><div class="segmented small"><button data-action="chartmode" data-value="expiry" class="${chartMode === "expiry" ? "selected" : ""}">到期损益</button><button data-action="chartmode" data-value="mark" class="${chartMode === "mark" ? "selected" : ""}">到期前估值</button><button data-action="chartmode" data-value="payoff" class="${chartMode === "payoff" ? "selected" : ""}">到期支付</button></div></div><div class="market-strip"><span>合成标的 <b>${money(market().spot)}</b></span><span>建仓期限 <b>${market().days} 天</b></span><span>建仓 IV <b>${Math.round(market().vol * 100)}%</b></span><span class="model-tag">欧式 · 乘数 1</span></div>${chartMode === "mark" ? `<div class="valuation-controls"><label>剩余 <b id="days-label">${days}</b> 天 <input aria-label="估值剩余天数" type="range" min="0" max="${market().days}" value="${days}" data-control="days"></label><label>估值 IV <b id="vol-label">${vol}%</b><input aria-label="估值隐含波动率" type="range" min="10" max="100" value="${vol}" data-control="vol"></label><span>建仓成本固定，仅重估持仓</span></div>` : ""}<div class="chart-wrap" id="chart-wrap">${chartSvg()}</div><div class="chart-legend"><span><i class="line green"></i>你的组合</span>${mode === "challenge" ? `<label><input type="checkbox" data-control="target" ${showTarget ? "checked" : ""}><i class="line dashed"></i>目标轮廓</label>` : ""}<span class="legend-right">横轴：标的价格 / 纵轴：美元${chartMode === "payoff" ? "支付" : "损益"}</span></div><div class="metrics" id="metrics">${metricsView(a)}</div></section><section class="library panel"><div class="panel-heading compact"><h2>${icon("blocks", 18)}积木盒</h2><span class="tiny-label">点击添加 · 也可拖入</span></div><div class="type-tabs">${level.types.map(t => `<button data-action="type" data-type="${t}" class="${libraryType === t ? "active" : ""}">${{ call: "Call", put: "Put", stock: "现货", cash: "现金" }[t]}</button>`).join("")}</div><div class="side-selector"><button data-action="side" data-side="1" class="${side === 1 ? "buy-active" : ""}">+ 买入</button><button data-action="side" data-side="-1" class="${side === -1 ? "sell-active" : ""}" ${!level.sell ? 'disabled title="本关仅可买入"' : ""}>− 卖出</button></div><div class="tool-cards">${libraryCards(level)}</div><div class="library-note">${icon("info", 14)} 每单位建仓费 ${money(market().fee)}，已计入损益。</div></section><section class="portfolio panel" id="portfolio-drop"><div class="panel-heading compact"><h2>你的组合 <span class="count-badge">${units(legs)} / ${level.maxUnits}</span></h2><span class="tiny-label">${legs.length ? "改变数量，曲线即时更新" : "把想法放进来"}</span></div>${legs.length ? `<div class="legs-list">${legs.map((l, i) => `<div class="leg-row"><span class="leg-icon ${l.type}">${{ call: "C", put: "P", stock: "S", cash: "$" }[l.type]}</span><div class="leg-description"><b>${legName(l)}</b><span>${l.qty > 0 ? "买入" : "卖出"} · 单价 ${money(quote(l))}</span></div><div class="quantity"><button data-action="qty" data-index="${i}" data-change="-1" aria-label="减少 ${legName(l)} 数量">${icon("minus", 13)}</button><span>${Math.abs(l.qty)}</span><button data-action="qty" data-index="${i}" data-change="1" aria-label="增加 ${legName(l)} 数量">${icon("plus", 13)}</button></div><span class="leg-cost">${money(l.qty * quote(l))}</span><button class="icon-button remove" data-action="remove" data-index="${i}" aria-label="移除 ${legName(l)}">${icon("close", 16)}</button></div>`).join("")}</div>` : `<div class="empty-portfolio"><span class="empty-blocks">${icon("blocks", 30)}<i>+</i></span><div><h3>第一块积木，从这里开始</h3><p>从左侧选择一张卡片，点击 + 添加到组合。</p></div></div>`}<div class="scenario-box"><div class="scenario-heading"><label for="scenario-slider">${icon("target", 15)}如果${chartMode !== "mark" ? "到期" : "估值时"}标的价格是 <b id="scenario-price">$${scenario}</b></label><strong class="${pnl(legs, scenario, chartMode !== "mark" ? 0 : days, vol / 100) >= 0 ? "positive" : "negative"}" id="scenario-pnl">${signed(pnl(legs, scenario, chartMode !== "mark" ? 0 : days, vol / 100))}</strong></div><input id="scenario-slider" data-control="scenario" aria-label="情景标的价格" type="range" min="${Math.floor(market().spot * 0.6)}" max="${Math.ceil(market().spot * 1.4)}" value="${scenario}"><div class="range-labels"><span>${money(market().spot * 0.6)}</span><span>${money(market().spot)}</span><span>${money(market().spot * 1.4)}</span></div></div><div class="portfolio-bottom">${current().infeasible ? '<button class="outline-button" data-action="impossible">判断条件无解</button>' : ""}<span>${icon("shield", 15)}${mode !== "sandbox" ? "先搭建，再验证你的想法" : "自由实验 · 最多 8 单位"}</span><button class="primary-button" data-action="${mode !== "sandbox" ? "submit" : "report"}" ${!legs.length ? "disabled" : ""}>${mode !== "sandbox" ? "检验组合" : "查看分析"}${icon("arrow", 17)}</button></div></section></div><div class="bottom-note">${icon("info", 15)}到期支付不扣成本；到期损益已扣初始成本与建仓费。到期前估值使用 Black–Scholes 模型。<button data-action="model">查看模型说明 ${icon("external", 12)}</button></div>`;
}
function missionView(l, result) {
  if (mode === "sandbox")
    return `<div class="mission-label">${icon("spark", 16)}自由实验</div><h2>把“如果”<br>变成一条曲线。</h2><p class="mission-brief">用四种积木自由构建组合，探索不同执行价、方向与数量带来的变化。</p><div class="sandbox-ideas"><b>可以从这些问题开始</b><p>01　同时买入 Call 和 Put 呢？</p><p>02　卖出的 Call 会限制什么？</p><p>03　现金能改变损益形状吗？</p></div><div class="mission-footer"><span class="pill">8 单位上限</span><span class="pill">双向持仓</span></div><button class="hint-button" data-action="presets">${icon("bulb", 17)}载入一个经典组合</button>`;
  return `<div class="mission-label"><span>CHALLENGE ${String(activeIndex() + 1).padStart(2, "0")}</span><span class="difficulty">${l.difficulty}</span></div><div class="level-steps" aria-label="选择关卡">${activeLevels()
    .map(
      (v, i) =>
        `<button data-action="level" data-index="${i}" class="${i === activeIndex() ? "current" : progress.completed[v.id] ? "done" : ""}" aria-label="第 ${i + 1} 关：${escapeText(v.title)}" ${i === activeIndex() ? 'aria-current="step"' : ""}>${progress.completed[v.id] ? icon("check", 12) : i + 1}</button>`
    )
    .join(
      ""
    )}</div><h2>${escapeText(l.title)}</h2><span class="topic-label">${escapeText(l.topic)}</span><p class="mission-brief">${escapeText(l.brief)}</p><div class="objective-title">${icon("target", 15)}你的任务<span>${result.checks.filter(c => c.pass).length}/${l.goals.length}</span></div><ul class="objectives">${result.checks.map(g => `<li class="${g.pass ? "passed" : ""}"><span class="check-circle">${g.pass ? icon("check", 11) : ""}</span><span>${goalLabel(g)}</span></li>`).join("")}</ul><div class="mission-footer"><span class="pill">最多 ${l.maxUnits} 单位</span><span class="pill">${l.sell ? "可买入 / 卖出" : "仅可买入"}</span></div><button class="hint-button" data-action="hint">${icon("bulb", 17)}需要一点灵感？${icon("chevron", 15)}</button>`;
}
function libraryCards(l) {
  const strikes = ["stock", "cash"].includes(libraryType) ? [0] : l.strikes;
  return strikes
    .map(k => {
      const item = { type: libraryType, strike: k, qty: side };
      const cost = quote(item);
      return `<button class="tool-card ${libraryType}" draggable="true" data-drag="${libraryType}:${k}" data-action="add" data-type="${libraryType}" data-strike="${k}" aria-label="${side === 1 ? "买入" : "卖出"} ${legName(item)}"><span class="tool-card-top"><span class="tool-symbol">${libraryType === "call" ? "C" : libraryType === "put" ? "P" : libraryType === "stock" ? "S" : "$"}</span><span>${typeName(libraryType)}</span><span class="tool-add">${icon("plus", 14)}</span></span><span class="tool-card-middle">${k ? `K <b>${k}</b>` : `<b>${libraryType === "stock" ? "1 单位" : "$10 面值"}</b>`}</span><span class="tool-card-bottom"><span>${k ? "30 天到期" : "零利率教学模型"}</span><b>${money(cost)}</b></span></button>`;
    })
    .join("");
}
function metricsView(a) {
  return `<div><span>初始净支出 ${icon("info", 12)}</span><b>${money(a.debit)}</b><small>含 ${money(a.fees)} 建仓费</small></div><div><span>到期最大收益</span><b class="positive">${a.maxProfit === Infinity ? "无限" : money(a.maxProfit)}</b><small>完整价格区间</small></div><div><span>到期最大损失</span><b class="${a.maxLoss > 0 ? "negative" : ""}">${a.maxLoss === Infinity ? "无限" : money(a.maxLoss)}</b><small>完整价格区间</small></div><div><span>到期盈亏平衡点</span><b>${!legs.length ? "—" : a.breakevens.length ? a.breakevens.map(n => "$" + n.toFixed(2)).join(" / ") : "无"}</b><small>${a.flat.length ? "存在零损益区间" : "已扣除初始成本"}</small></div>`;
}
function chartSvg() {
  const w = 800,
    h = 260,
    L = 54,
    R = 22,
    T = 23,
    B = 31,
    range = [market().spot * 0.6, market().spot * 1.4],
    expiry = chartMode !== "mark";
  const chartValue = (ls, s) =>
    pnl(ls, s, expiry ? 0 : days, vol / 100) +
    (chartMode === "payoff" ? analyze(ls).debit : 0);
  const pts = Array.from({ length: 161 }, (_, i) => {
    const s = range[0] + ((range[1] - range[0]) * i) / 160;
    return [s, chartValue(legs, s)];
  });
  const target = mode === "challenge" && showTarget ? current().solution : [];
  const tp = target.length ? pts.map(([s]) => [s, chartValue(target, s)]) : [];
  const ys = [-6, 10, ...pts.map(p => p[1]), ...tp.map(p => p[1])];
  let min = Math.min(...ys),
    max = Math.max(...ys);
  const pad = (max - min) * 0.15;
  min -= pad;
  max += pad;
  const x = s => L + ((s - range[0]) / (range[1] - range[0])) * (w - L - R),
    y = v => T + ((max - v) / (max - min)) * (h - T - B);
  const path = p =>
    p
      .map(
        ([s, v], i) => (i ? "L" : "M") + x(s).toFixed(2) + "," + y(v).toFixed(2)
      )
      .join(" ");
  const zero = y(0),
    bottom = h - B;
  const area = path(pts) + ` L${x(range[1])},${zero} L${x(range[0])},${zero} Z`;
  const ticks = Array.from(
    { length: 5 },
    (_, i) => min + ((max - min) * i) / 4
  );
  return `<svg id="payoff-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${chartMode === "payoff" ? "到期支付" : expiry ? "到期损益" : "到期前估值"}曲线，标的价格 ${range[0].toFixed(0)} 至 ${range[1].toFixed(0)} 美元"><defs><linearGradient id="profit-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#a8d9af" stop-opacity=".48"/><stop offset="100%" stop-color="#a8d9af" stop-opacity=".04"/></linearGradient><linearGradient id="loss-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#eeb6a7" stop-opacity=".08"/><stop offset="100%" stop-color="#eeb6a7" stop-opacity=".32"/></linearGradient><clipPath id="profit-clip"><rect x="${L}" y="${T}" width="${w - L - R}" height="${Math.max(0, zero - T)}"/></clipPath><clipPath id="loss-clip"><rect x="${L}" y="${zero}" width="${w - L - R}" height="${bottom - zero}"/></clipPath></defs>${ticks.map(v => `<line x1="${L}" x2="${w - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e8ece6" stroke-dasharray="3 5"/><text x="${L - 12}" y="${y(v) + 4}" text-anchor="end" fill="#8b948e" font-size="10">${v.toFixed(0)}</text>`).join("")}${Array.from(
    { length: 5 },
    (_, i) => range[0] + ((range[1] - range[0]) * i) / 4
  )
    .map(
      s =>
        `<text x="${x(s)}" y="${h - 9}" text-anchor="middle" fill="#8b948e" font-size="10">$${s.toFixed(0)}</text>`
    )
    .join(
      ""
    )}<line x1="${L}" x2="${w - R}" y1="${zero}" y2="${zero}" stroke="#b9c4b8"/><line x1="${x(market().spot)}" x2="${x(market().spot)}" y1="${T}" y2="${bottom}" stroke="#c8d0c7" stroke-dasharray="3 4"/><text x="${x(market().spot)}" y="14" text-anchor="middle" fill="#8b948e" font-size="10">建仓价 $${market().spot}</text><path d="${area}" fill="url(#profit-fill)" clip-path="url(#profit-clip)"/><path d="${area}" fill="url(#loss-fill)" clip-path="url(#loss-clip)"/>${tp.length ? `<path d="${path(tp)}" fill="none" stroke="#bdc8b9" stroke-width="2" stroke-dasharray="5 6"/>` : ""}<path d="${path(pts)}" fill="none" stroke="#3e8063" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>${!legs.length ? `<g><rect x="262" y="83" width="276" height="45" rx="9" fill="#fff" stroke="#e5e9e0"/><text x="400" y="110" fill="#798578" font-size="13" text-anchor="middle">添加第一块积木，看看曲线如何改变</text></g>` : ""}<line x1="${x(scenario)}" x2="${x(scenario)}" y1="${T}" y2="${bottom}" stroke="#4c8066" stroke-dasharray="2 4" opacity=".45"/><circle cx="${x(scenario)}" cy="${y(chartValue(legs, scenario))}" r="4.5" fill="#3e8063" stroke="white" stroke-width="2"/><rect data-chart-hit="true" x="${L}" y="${T}" width="${w - L - R}" height="${bottom - T}" fill="transparent"/></svg><div id="chart-tooltip" class="chart-tooltip" hidden></div>`;
}
function bindChart() {
  const svg = document.querySelector("#payoff-chart");
  if (!svg) return;
  svg.addEventListener("pointermove", e => {
    const r = svg.getBoundingClientRect(),
      px = ((e.clientX - r.left) / r.width) * 800,
      s = Math.max(
        market().spot * 0.6,
        Math.min(
          market().spot * 1.4,
          market().spot * 0.6 + ((px - 54) / 724) * market().spot * 0.8
        )
      );
    const v =
      pnl(legs, s, chartMode !== "mark" ? 0 : days, vol / 100) +
      (chartMode === "payoff" ? analyze(legs).debit : 0);
    const tt = document.querySelector("#chart-tooltip");
    tt.hidden = false;
    tt.textContent = `标的 $${s.toFixed(2)} · ${chartMode === "payoff" ? "支付" : "损益"} ${signed(v)}`;
    tt.style.left =
      Math.max(0, Math.min(r.width - 205, e.clientX - r.left - 80)) + "px";
    tt.style.top = "25px";
  });
  svg.addEventListener("pointerleave", () => {
    document.querySelector("#chart-tooltip").hidden = true;
  });
}

function gamesView() {
  return `${pageHeading("LEARN BY PLAYING", "让交易知识，<br>在游戏里生长。", "一次专注一个概念。用实验、挑战和复盘，建立自己的交易直觉。")}<div class="hub-banner"><div><span class="pill">第一站 · 从收益结构出发</span><h2>复杂策略，<br>从简单积木开始。</h2><p>不用背策略名字。亲手拼出一条曲线，<br>看看你赚的是什么，又承担了什么。</p><button class="primary-button" data-action="start">开始期权积木 ${icon("arrow", 18)}</button></div><div class="block-illustration" aria-hidden="true"><div class="float-block block-call"><small>BUY</small><b>Call</b><span>↗</span></div><div class="float-block block-put"><small>PROTECT</small><b>Put</b><span>↘</span></div><svg viewBox="0 0 360 190"><path d="M15 150H105L230 40H345" fill="none" stroke="#476c4e" stroke-width="3" stroke-dasharray="7 5"/></svg><div class="little-block">S</div></div></div><div class="section-title"><h2>选择你的训练场</h2><span>一个游戏，一种思维方式</span></div><div class="game-grid">${GAMES.map(g => `<article class="game-card ${g.color}"><span class="game-icon">${icon(g.icon, 27)}</span><span class="game-status ${g.status === "live" ? "live" : ""}">${g.status === "live" ? "现已开放" : "未来计划"}</span><small>${g.en}</small><h3>${g.name}</h3><p>${g.description}</p><div class="game-card-footer"><span>${g.tag}</span><button data-action="${g.status === "live" ? "start" : "future"}" data-game="${g.id}">${g.status === "live" ? "进入游戏" : "了解构想"}${icon("arrow", 16)}</button></div></article>`).join("")}</div><div class="principles"><span>${icon("clock", 18)}短关卡，随时开始</span><span>${icon("shield", 18)}模拟环境，放心试错</span><span>${icon("bulb", 18)}看清收益，也理解代价</span></div>`;
}
function learnView() {
  return `${pageHeading("FIELD GUIDE", "把曲线，读成直觉。", "从积木的规则，到组合的取舍。需要的时候，随时回来看看。")}<div class="learning-grid">${[
    {
      symbol: "C",
      name: "Call · 看涨期权",
      desc: "买入 Call：到期价格超过执行价时，获得差额；否则到期价值为零。",
      formula: "到期价值 = max(S − K, 0)",
      tip: "到期价值不等于净利润。还需要扣除权利金和费用。",
      cls: "green",
    },
    {
      symbol: "P",
      name: "Put · 看跌期权",
      desc: "买入 Put：到期价格低于执行价时，获得差额；否则到期价值为零。",
      formula: "到期价值 = max(K − S, 0)",
      tip: "Put 可以表达看跌观点，也可以保护现货的下行。",
      cls: "purple",
    },
    {
      symbol: "S",
      name: "现货 · 直接持有标的",
      desc: "一单位现货的到期价值等于标的价格，涨跌直接反映在持仓中。",
      formula: "单腿损益 = S − 100 − 费用",
      tip: "卖出现货在模型中可表达空头，但上行损失可能无限。",
      cls: "orange",
    },
    {
      symbol: "$",
      name: "现金 · 一块平直的积木",
      desc: "每块现金面值 $10；本模型利率为零，因此到期价值仍为 $10。",
      formula: "到期损益 = 0 − 建仓费",
      tip: "现金改变初始资金占用，不会凭空产生收益。",
      cls: "blue",
    },
  ]
    .map(
      c =>
        `<article class="learn-card ${c.cls}"><span class="learn-symbol">${c.symbol}</span><h2>${c.name}</h2><p>${c.desc}</p><code>${c.formula}</code><div>${icon("bulb", 16)}<span>${c.tip}</span></div></article>`
    )
    .join(
      ""
    )}</div><section class="panel explain-panel"><h2>两张图，回答两个问题</h2><div class="explain-columns"><div><span class="eyebrow">AT EXPIRATION</span><h3>到期损益</h3><p>到期时，每条期权只剩内在价值。组合的最终价值减去建仓净支出，得到已经扣费的到期损益。</p></div><div><span class="eyebrow">BEFORE EXPIRATION</span><h3>到期前估值</h3><p>尚未到期的期权可能仍有时间价值。切换剩余天数和 IV，观察重估后的组合损益。它不是最终结算，也不是实现收益。</p></div></div></section><section class="panel explain-panel"><h2>先记住这四个区别</h2><div class="glossary"><div><b>权利金 / 利润</b><p>收到权利金后仍可能承担履约损失。净收入不是无风险收益。</p></div><div><b>最大损失 / 图内最低点</b><p>风险计算覆盖所有非负价格，包含超出图表右端的无限风险。</p></div><div><b>情景检查 / 概率预测</b><p>拖动价格是在问“如果发生会怎样”，不代表预测概率或收益率。</p></div><div><b>初始净支出 / 保证金</b><p>净支出包含买卖权利金与建仓费。游戏没有交易所保证金与强平机制。</p></div></div><button class="outline-button" data-action="model">完整模型与参考资料 ${icon("external", 15)}</button></section>`;
}
function progressView() {
  return `${pageHeading("YOUR JOURNEY", "每一次尝试，都算数。", "学习进度保存在当前浏览器。完成关卡后，继续探索新的组合。", `<button class="outline-button" data-action="export">${icon("download", 16)}导出学习记录</button>`)}<div class="progress-stats"><div><span>基础关卡完成</span><strong>${completed()}<small> / 6</small></strong></div><div><span>基础关星星</span><strong>${totalStars()}<small> / 18</small></strong></div><div><span>探索阶段</span><strong class="stage-name">${completed() === 6 ? "积木探索家" : completed() > 2 ? "策略探索者" : "新手建造师"}</strong></div></div><div class="journey-list">${[
    ...LEVELS,
    ...TRANSFERS,
    ...courseLessons,
  ]
    .map((l, i) => {
      const p = progress.completed[l.id];
      return `<article class="journey-row"><span class="journey-number ${p ? "finished" : ""}">${p ? icon("check", 22) : String(i + 1).padStart(2, "0")}</span><div><span class="tiny-label">${escapeText(l.topic)}</span><h3>${escapeText(l.title)}</h3><p>${l.concept}</p></div><span class="stars">${p ? "★".repeat(p.stars) + "☆".repeat(3 - p.stars) : "☆☆☆"}</span><button class="outline-button" data-action="${i < 6 ? "openlevel" : i < 9 ? "opentransfer" : "opencourse"}" data-index="${i < 6 ? i : i < 9 ? i - 6 : i - 9}">${p ? "再次挑战" : "开始挑战"}${icon("arrow", 16)}</button></article>`;
    })
    .join(
      ""
    )}</div>${predictionProgress()}<p class="muted">星级规则：独立完成 3 星，查看提示后完成 2 星，载入示范后完成 1 星。重复挑战取历史最高星级。</p>`;
}
function roadmapView() {
  const phases = [
    {
      status: "已交付 · 期权积木 v0.4",
      title: "从解题，到制作课程",
      items: [
        "可视化编辑与参考解校验",
        "多课程收藏、内容修订和冲突预览",
        "保留旧版任务成绩与草稿",
      ],
    },
    {
      status: "已交付 · 波动率捕手 v0.2",
      title: "先定规则，再看分布",
      items: [
        "首次预测与一句话复盘",
        "锁定阈值、对冲间隔、费用与价差",
        "32 条新路径对照与成本敏感性",
      ],
    },
    {
      status: "首个版本 · 产品工坊 v0.1",
      title: "让每项承诺都有资金来源",
      items: [
        "部分保护参与型、到期收益增强、已有现货 Collar",
        "客户硬约束、资金来源和风险解释",
        "客户与发行方 / 执行柜台双面账本",
      ],
    },
    {
      status: "下一步 · 先补学习证据",
      title: "让理解走得更远",
      items: [
        "5–8 位学习者观察与交互修正",
        "课程分层提示、找错题与资金条件",
        "对冲规则的预注册多批次评估",
        "工坊报价、信用风险与发行方动态对冲",
      ],
    },
  ];
  return `${pageHeading("NEXT CHAPTER", "从设计结构，<br>到解释每笔现金。", "本版交付三款游戏；下一步围绕学习者反馈和模型边界继续推进。")}<div class="roadmap-intro"><span class="status-dot"></span>平台 v0.4 · 三款训练场<span>浏览器本地记录 · 合成教学市场</span></div><div class="roadmap-grid">${phases.map((p, i) => `<article class="roadmap-card ${i < 3 ? "current" : ""}"><span class="roadmap-number">0${i + 1}</span><span class="pill">${p.status}</span><h2>${p.title}</h2><ul>${p.items.map(x => `<li>${icon("check", 14)}${x}</li>`).join("")}</ul></article>`).join("")}</div><section class="panel explain-panel"><h2>完成，不自动等于理解。</h2><p class="muted">星级、首次预测、风险区间和解释分别记录。尚未执行正式学习者研究，也不提供专业能力认证或真实市场表现保证。未来扩展融资、保证金、信用和障碍条款时，先明确资金与风险规则，再增加玩法。</p></section>`;
}

function openModal(title, body, wide = false) {
  if (!document.querySelector(".modal")) modalReturn = document.activeElement;
  document.querySelector("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close" aria-label="关闭弹窗">${icon("close")}</button></div><div class="modal-body">${body}</div></section></div>`;
  document.body.classList.add("modal-open");
  document.querySelector(".modal").focus();
}
function closeModal() {
  document.querySelector("#modal-root").innerHTML = "";
  document.body.classList.remove("modal-open");
  if (modalReturn?.isConnected) modalReturn.focus();
}
function guide() {
  openModal(
    "三步，拼出你的第一条曲线",
    `<p class="modal-lead">不用先背策略，先动手试一次。</p><div class="guide-steps"><div><b>01</b><span><strong>读懂任务</strong><p>看看初始预算、最大损失和指定价格下的收益要求。每关还有工具与数量限制。</p></span></div><div><b>02</b><span><strong>先预测，再添加积木</strong><p>基础关第一次添加前先回答概念预测。再用积木验证；撤销、回放与组合比较能帮助你观察取舍。</p></span></div><div><b>03</b><span><strong>检验想法，理解取舍</strong><p>点击“检验组合”，逐条检查约束。完成后阅读复盘，再挑战下一关。</p></span></div></div><div class="callout">${icon("bulb", 18)}<p>基础关可以查看目标轮廓。迁移挑战改变初始价格、费用或 IV，并关闭目标轮廓和示范解。绿色实线是你的组合，虚线是供参考的目标轮廓；评分检查任务条件。</p></div><button class="primary-button" data-action="close">开始搭建 ${icon("arrow", 16)}</button>`
  );
}
function model() {
  openModal(
    "模型规则与学习资料",
    `<div class="model-grid"><div><b>合约与单位</b><p>当前标的初始价 ${money(market().spot)}。欧式、现金结算、同一期限 30 天、乘数 1，所有金额均为美元。每块现金面值 $10。</p></div><div><b>价格与成本</b><p>建仓权利金用 Black–Scholes 计算，当前建仓 IV=${Math.round(market().vol * 100)}%，无风险利率与股息率均为零。每净持仓单位收取 ${money(market().fee)} 建仓费；调整积木是重新构建组合，不是逐笔交易。</p></div><div><b>损益与估值</b><p>到期损益 = 到期组合价值 − 初始净支出。到期前损益 = 重估组合价值 − 固定的初始净支出。未模拟额外平仓费、价差、滑点、利息与税费。</p></div><div><b>风险与评分</b><p>最大风险由所有执行价折点、S=0 与右端斜率计算，覆盖 S≥0。到期前估值滑块不改变任务评分，任务始终按到期损益检验。净支出不是保证金要求。</p></div></div><div class="callout">${icon("info", 18)}<p>这是规则简化的教学环境。真实合约可能有不同乘数、行权与保证金机制；本游戏没有提前行权、强平、流动性、波动率曲面和真实行情。</p></div><h3>进一步阅读 · 官方教育资料</h3><div class="source-links"><a href="https://www.optionseducation.org/strategies/all-strategies/bull-call-spread-debit-call-spread" target="_blank" rel="noopener noreferrer">OIC · 牛市看涨价差 ${icon("external", 15)}</a><a href="https://www.optionseducation.org/strategies/all-strategies/protective-put-married-put" target="_blank" rel="noopener noreferrer">OIC · 保护性看跌 ${icon("external", 15)}</a><a href="https://www.optionseducation.org/advancedconcepts/black-scholes-formula" target="_blank" rel="noopener noreferrer">OIC · Black–Scholes 公式 ${icon("external", 15)}</a></div>`,
    true
  );
}
function hint() {
  hints[current().id] = Math.max(1, hints[current().id] || 0);
  persist();
  openModal(
    "给你一点灵感",
    `<div class="hint-hero">${icon("bulb", 30)}</div><p class="modal-lead">${escapeText(current().hint)}</p><p class="muted">查看提示后，本次完成最多获得 2 星。你仍可以自行调整和验证组合。</p><div class="modal-actions">${mode === "challenge" ? '<button class="outline-button" data-action="solution">载入示范组合</button>' : '<span class="muted">迁移挑战不提供示范。</span>'}<button class="primary-button" data-action="close">我再试试 ${icon("arrow", 16)}</button></div>`
  );
}
function scenarioPoints() {
  return [
    ...new Set([
      market().spot - 20,
      market().spot,
      market().spot + 20,
      ...current()
        .goals.filter(g => g.kind === "scenario")
        .map(g => g.spot),
    ]),
  ].sort((a, b) => a - b);
}
function report() {
  const level = current(),
    a = analyze(legs),
    isChallenge = mode !== "sandbox",
    r = isChallenge ? checkLevel(level, legs) : null;
  let stars = 0;
  if (r?.pass) {
    stars = Math.max(1, 3 - (hints[level.id] || 0));
    const old = progress.completed[level.id];
    if (!old || stars > old.stars) {
      progress.completed[level.id] = {
        stars,
        completedAt: new Date().toISOString(),
        legs: legs.map(l => ({ ...l })),
        modelVersion: 2,
      };
    }
    persist();
    render();
  }
  openModal(
    r
      ? r.pass
        ? "拼得漂亮，任务完成！"
        : "再调整一下，就更接近了。"
      : "你的组合分析",
    `<div class="result-banner ${r?.pass ? "success" : ""}"><span>${icon(r?.pass ? "trophy" : "activity", 30)}</span><div><b>${r ? (r.pass ? `第 ${activeIndex() + 1} 关 · ${escapeText(level.topic)}` : "看看哪些条件还没有满足") : "每一条曲线，都表达了一种取舍"}</b><p>${r?.pass ? `本次获得 ${"★".repeat(stars)}${"☆".repeat(3 - stars)} · 历史最佳 ${progress.completed[level.id].stars} 星` : r ? "所有任务条件都通过后，即可完成本关。" : "最大风险覆盖完整价格区间，情景价格仅用于观察。"}</p></div></div>${r ? `<ul class="result-checks">${r.checks.map(c => `<li><span class="${c.pass ? "positive" : "negative"}">${icon(c.pass ? "check" : "close", 16)}</span><span>${goalLabel(c)}</span><b>${c.kind === "tailSlope" ? c.actual.toFixed(2) : money(c.actual)}</b></li>`).join("")}</ul>` : `<div class="report-summary"><span>最大收益 <b>${money(a.maxProfit)}</b></span><span>最大损失 <b>${money(a.maxLoss)}</b></span><span>建仓 Delta <b>${((pnl(legs, market().spot + 0.001, market().days, market().vol) - pnl(legs, market().spot - 0.001, market().days, market().vol)) / 0.002).toFixed(3)}</b></span></div>`}<h3>把组合放进关键到期情景</h3><div class="scenario-table"><div><span>标的价格</span><span>组合到期价值</span><span>净损益（扣费）</span></div>${scenarioPoints()
      .map(
        s =>
          `<div><b>$${s}</b><span>${money(pnl(legs, s) + a.debit)}</span><b class="${pnl(legs, s) >= 0 ? "positive" : "negative"}">${signed(pnl(legs, s))}</b></div>`
      )
      .join(
        ""
      )}</div><p class="accounting-note">初始净支出 ${money(a.debit)}，其中建仓费 ${money(a.fees)}。费用只扣除一次。</p><div class="callout">${icon("bulb", 20)}<p>${isChallenge ? (r.pass ? escapeText(level.lesson) : "先查看未通过的条件与实际数值，再比较不同执行价或调整组合方向。需要更具体的思路，可以使用关卡提示。") : "切换到期前估值，保持建仓成本不变，再改变时间和 IV。到期前的曲线通常更圆滑，因为期权仍有时间价值。"}</p></div>${a.maxLoss === Infinity ? '<p class="negative">这个组合存在无限损失风险。当前图表的价格范围无法展示全部潜在损失。</p>' : ""}<div class="modal-actions"><button class="outline-button" data-action="export">${icon("download", 15)}导出记录</button><button class="primary-button" data-action="${r?.pass ? (activeIndex() < activeLevels().length - 1 ? "next" : "finish") : "close"}">${r?.pass ? (activeIndex() < activeLevels().length - 1 ? "下一关" : "查看学习进度") : "继续探索"}${icon("arrow", 16)}</button></div>`,
    true
  );
}
function exportRecord() {
  const a = analyze(legs);
  const payload = {
    application: "交易游乐场 · 期权积木",
    version: 3,
    exportedAt: new Date().toISOString(),
    market: market(),
    progress,
    workspace: {
      level: current().id,
      legs,
      analysis: a,
      scenarios: scenarioPoints().map(spot => ({ spot, pnl: pnl(legs, spot) })),
    },
  };
  const blob = new Blob(
    [
      JSON.stringify(
        payload,
        (_, v) =>
          typeof v === "number" && !Number.isFinite(v)
            ? v > 0
              ? "Infinity"
              : "-Infinity"
            : v,
        2
      ),
    ],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "trade-arcade-progress.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("学习记录已导出。");
}
function setLevel(i) {
  persist();
  if (mode === "course")
    courseIndex = Math.max(0, Math.min(courseLessons.length - 1, i));
  else if (mode === "transfer") transferIndex = Math.max(0, Math.min(2, i));
  else {
    levelIndex = Math.max(0, Math.min(5, i));
    mode = "challenge";
  }
  chartMode = "expiry";
  restore();
  persist();
  render();
}
function updateLegs(next, label = "调整积木") {
  if (!next) {
    toast(`本模式最多放入 ${current().maxUnits} 单位积木。`);
    return;
  }
  timeline = recordStep(timeline, next, label);
  legs = next;
  persist();
  render();
}
function add(type, strike) {
  if (
    !Number.isFinite(strike) ||
    (["stock", "cash"].includes(type) && strike !== 0)
  )
    return;
  if (mode === "challenge" && !progress.predictions[current().id]) {
    pendingAdd = { type, strike };
    predict();
    return;
  }
  if (!current().types.includes(type) || (!current().sell && side < 0)) return;
  if (["call", "put"].includes(type) && !current().strikes.includes(strike))
    return;
  updateLegs(
    mergeLeg(legs, { type, strike, qty: side }, current().maxUnits),
    `${side > 0 ? "买入" : "卖出"} ${typeName(type)} ${strike || ""}`
  );
}

document.addEventListener("click", e => {
  if (e.target.closest(".skip")) {
    e.preventDefault();
    document.querySelector("#main").focus();
    return;
  }
  if (e.target.classList.contains("modal-backdrop")) {
    closeModal();
    return;
  }
  const button = e.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const d = button.dataset;
  switch (d.action) {
    case "predict":
      pendingAdd = null;
      predict();
      break;
    case "answer":
      answerPrediction(Number(d.index));
      break;
    case "resumeadd":
      closeModal();
      if (pendingAdd) {
        const item = pendingAdd;
        pendingAdd = null;
        add(item.type, item.strike);
      }
      break;
    case "undo":
      travel(-1);
      break;
    case "redo":
      travel(1);
      break;
    case "replay":
      replayIndex = timeline.cursor;
      replay();
      break;
    case "replaystep":
      replayIndex = Number(d.index);
      replay();
      break;
    case "pin":
      if (!legs.length) break;
      progress.comparisons[current().id] = legs.map(l => ({ ...l }));
      persist();
      toast("已保存当前组合为对照，可调整后比较。");
      break;
    case "compare":
      compare();
      break;
    case "opencourse":
      persist();
      mode = "course";
      courseIndex = Number(d.index);
      restore();
      persist();
      navTo("play");
      break;
    case "opentransfer":
      persist();
      mode = "transfer";
      restore();
      setLevel(Number(d.index));
      navTo("play");
      break;
    case "guide":
      guide();
      break;
    case "model":
      model();
      break;
    case "close":
      closeModal();
      break;
    case "hint":
      hint();
      break;
    case "mode":
      persist();
      mode = d.mode;
      restore();
      chartMode = "expiry";
      render();
      break;
    case "chartmode":
      chartMode = d.value;
      render();
      break;
    case "level":
      setLevel(Number(d.index));
      break;
    case "openlevel":
      persist();
      mode = "challenge";
      restore();
      setLevel(Number(d.index));
      navTo("play");
      break;
    case "type":
      libraryType = d.type;
      render();
      break;
    case "side":
      side = Number(d.side);
      render();
      break;
    case "add":
      add(d.type, Number(d.strike));
      break;
    case "remove":
      updateLegs(
        legs.filter((_, i) => i !== Number(d.index)),
        "移除积木"
      );
      break;
    case "qty": {
      const index = Number(d.index),
        l = legs[index];
      if (!l) break;
      const n = Number(d.change);
      updateLegs(
        mergeLeg(legs, { ...l, qty: Math.sign(l.qty) * n }, current().maxUnits)
      );
      break;
    }
    case "reset":
      openModal(
        "重新搭建这个组合？",
        '<p class="modal-lead">将清空当前积木。已获得的星星和已完成关卡会保留。</p><div class="modal-actions"><button class="outline-button" data-action="close">继续当前组合</button><button class="primary-button" data-action="confirmreset">清空组合</button></div>'
      );
      break;
    case "confirmreset":
      hints[current().id] = 0;
      timeline = newTimeline([]);
      legs = [];
      persist();
      closeModal();
      render();
      break;
    case "solution":
      hints[current().id] = 2;
      updateLegs(
        current().solution.map(l => ({ ...l })),
        "载入示范"
      );
      closeModal();
      toast("已载入示范。观察每条腿如何改变曲线，再点击检验组合。");
      break;
    case "impossible": {
      const proof = enumerate(current());
      if (proof.feasible) {
        toast("当前任务有可行解，继续调整组合。");
        break;
      }
      progress.completed[current().id] = {
        stars: Math.max(1, 3 - (hints[current().id] || 0)),
        legs: [],
        certificate: proof,
        completedAt: new Date().toISOString(),
        modelVersion: 3,
      };
      persist();
      render();
      openModal(
        "当前条件内，没有可行组合",
        `<p class="modal-lead">${escapeText(proof.scope)}</p><p class="muted">已检查 ${proof.checked} 个枚举节点。空组合不能满足非空提交要求，其余允许持仓均无法同时满足条件。这不是对所有合约集合的无解断言。</p><div class="callout">${icon("bulb", 18)}<p>${escapeText(current().lesson)}</p></div>`
      );
      break;
    }
    case "submit":
    case "report":
      report();
      break;
    case "next":
      closeModal();
      setLevel(activeIndex() + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      break;
    case "finish":
      closeModal();
      navTo("progress");
      break;
    case "start":
      navTo(["gamma", "structured"].includes(d.game) ? d.game : "play");
      break;
    case "export":
      exportRecord();
      break;
    case "future": {
      const g = GAMES.find(g => g.id === d.game);
      openModal(
        g.name,
        `<span class="eyebrow">${g.en} · 尚未上线</span><p class="modal-lead">${g.description}</p><p>这款游戏处于产品规划阶段。将沿用统一的游戏大厅、进度系统和复盘体验，围绕“${g.tag}”建立新的学习关卡。</p><div class="modal-actions"><button class="outline-button" data-action="close">继续浏览</button><button class="primary-button" data-action="roadmap">查看开发路线 ${icon("arrow", 16)}</button></div>`
      );
      break;
    }
    case "roadmap":
      closeModal();
      navTo("roadmap");
      break;
    case "presets":
      openModal(
        "从经典组合开始",
        `<p>载入后仍可自由改变方向与数量。</p><div class="preset-list">${LEVELS.map((l, i) => `<button data-action="preset" data-index="${i}"><span><b>${escapeText(l.topic)}</b><small>${l.concept}</small></span>${icon("arrow", 18)}</button>`).join("")}</div>`
      );
      break;
    case "preset":
      updateLegs(
        LEVELS[Number(d.index)].solution.map(l => ({ ...l })),
        "载入经典组合"
      );
      closeModal();
      break;
  }
});
document.addEventListener("input", e => {
  const c = e.target.dataset.control;
  if (!c || c === "target") return;
  if (c === "scenario") scenario = Number(e.target.value);
  if (c === "days") {
    days = Number(e.target.value);
    document.querySelector("#days-label").textContent = days;
  }
  if (c === "vol") {
    vol = Number(e.target.value);
    document.querySelector("#vol-label").textContent = vol + "%";
  }
  document.querySelector("#chart-wrap").innerHTML = chartSvg();
  bindChart();
  const v = pnl(legs, scenario, chartMode !== "mark" ? 0 : days, vol / 100);
  document.querySelector("#scenario-price").textContent = "$" + scenario;
  const el = document.querySelector("#scenario-pnl");
  el.textContent = signed(v);
  el.className = v >= 0 ? "positive" : "negative";
});
document.addEventListener("change", e => {
  if (e.target.dataset.control === "target") {
    showTarget = e.target.checked;
    document.querySelector("#chart-wrap").innerHTML = chartSvg();
    bindChart();
  }
});
document.addEventListener("dragstart", e => {
  const card = e.target.closest("[data-drag]");
  if (card) {
    e.dataTransfer.setData("text/plain", card.dataset.drag);
    e.dataTransfer.effectAllowed = "copy";
  }
});
document.addEventListener("dragover", e => {
  const drop = e.target.closest("#portfolio-drop");
  if (drop) {
    e.preventDefault();
    drop.classList.add("drag-over");
  }
});
document.addEventListener("dragleave", e => {
  const drop = e.target.closest("#portfolio-drop");
  if (drop && !drop.contains(e.relatedTarget))
    drop.classList.remove("drag-over");
});
document.addEventListener("drop", e => {
  const drop = e.target.closest("#portfolio-drop");
  if (!drop) return;
  e.preventDefault();
  drop.classList.remove("drag-over");
  const [type, k] = e.dataTransfer.getData("text/plain").split(":");
  if (current().types.includes(type)) add(type, Number(k));
});
document.addEventListener("keydown", e => {
  const modal = document.querySelector(".modal");
  if (!modal) return;
  if (e.key === "Escape") {
    closeModal();
    return;
  }
  if (e.key === "Tab") {
    const f = [
      ...modal.querySelectorAll("button:not([disabled]),a[href],input"),
    ];
    if (!f.length) {
      e.preventDefault();
      return;
    }
    const first = f[0],
      last = f.at(-1);
    if (
      e.shiftKey &&
      (document.activeElement === first || document.activeElement === modal)
    ) {
      e.preventDefault();
      last.focus();
    } else if (
      !e.shiftKey &&
      (document.activeElement === last || document.activeElement === modal)
    ) {
      e.preventDefault();
      first.focus();
    }
  }
});
render();
if (route === "share")
  queueMicrotask(() => contentUI.previewShare(location.hash.slice(7)));
