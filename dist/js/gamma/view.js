import {
  SCENARIOS,
  startGame,
  snapshot,
  decide,
  advance,
  result,
  runPolicy,
  replayDecisions,
} from "./engine.js";
import {
  DEFAULT_RULES,
  normalizeRules,
  engineConfig,
  QUESTIONS,
  predictionSummary,
  evaluateRules,
} from "./rules.js";
import { icon, money, signed } from "../ui.js";
const KEY = "trade-arcade:gamma:v2";
const LEGACY_KEY = "trade-arcade:gamma:v1";
const esc = s =>
  String(s).replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]
  );
export function restoreSession(raw) {
  if (
    !raw ||
    ![1, 2].includes(raw.version) ||
    !SCENARIOS.some(s => s.id === raw.kind) ||
    !Number.isInteger(raw.seed) ||
    raw.seed < 0 ||
    raw.seed > 4294967295 ||
    !Number.isInteger(raw.index) ||
    raw.index < 0 ||
    raw.index > 8 ||
    !Array.isArray(raw.choices) ||
    raw.choices.length < raw.index ||
    raw.choices.length > Math.min(8, raw.index + 1) ||
    raw.choices.some(f => ![0, 0.5, 1].includes(f))
  )
    throw Error("Invalid saved session");
  const rules = raw.version === 2 ? normalizeRules(raw.rules) : DEFAULT_RULES;
  let s = replayDecisions(
    raw.kind,
    raw.seed,
    raw.choices.slice(0, raw.index),
    engineConfig(rules)
  );
  if (raw.choices.length > raw.index) s = decide(s, raw.choices.at(-1));
  if (raw.learning !== undefined) {
    const p = raw.learning;
    if (
      !p ||
      typeof p !== "object" ||
      typeof (p.reflection || "") !== "string" ||
      (p.reflection || "").length > 500 ||
      !p.predictions ||
      typeof p.predictions !== "object" ||
      Array.isArray(p.predictions) ||
      Object.entries(p.predictions).some(
        ([k, v]) =>
          !QUESTIONS[k] ||
          Number(k) > raw.index ||
          !Number.isInteger(v) ||
          v < 0 ||
          v > 2
      )
    )
      throw Error("学习记录无效");
    s.learning = {
      predictions: { ...p.predictions },
      reflection: p.reflection || "",
    };
  }
  return s;
}
export const serializeSession = s => ({
  version: 2,
  rules: {
    threshold: s.c.threshold ?? 15,
    interval: s.c.interval ?? 2,
    feeBps: s.c.feeRate * 10000,
    spreadBps: s.c.spreadRate * 10000,
  },
  ...(s.learning ? { learning: s.learning } : {}),
  kind: s.kind,
  seed: s.seed,
  index: s.index,
  choices: s.decisions.map(d => d.fraction),
});
function chart(s) {
  const visible = s.path.slice(0, s.index + 1),
    lo = Math.min(...visible.map(x => x.spot)) - 4,
    hi = Math.max(...visible.map(x => x.spot)) + 4,
    w = 760,
    h = 220,
    x = i => 45 + (i / 8) * 690,
    y = v => 25 + ((hi - v) / (hi - lo)) * 155;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="已经观察到的标的价格，未展示未来路径"><defs><linearGradient id="gamma-area" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#cfc0e0" stop-opacity=".45"/><stop offset="1" stop-color="#cfc0e0" stop-opacity="0"/></linearGradient></defs>${[
    0, 1, 2, 3,
  ]
    .map(i => {
      const v = lo + ((hi - lo) * i) / 3;
      return `<line x1="45" x2="735" y1="${y(v)}" y2="${y(v)}" stroke="#eae6ef" stroke-dasharray="3 5"/><text x="34" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#8b7f97">${v.toFixed(1)}</text>`;
    })
    .join(
      ""
    )}${Array.from({ length: 9 }, (_, i) => `<text x="${x(i)}" y="206" text-anchor="middle" font-size="10" fill="#8b7f97">${i}</text>`).join("")}<path d="M${x(0)},180 ${visible.map((m, i) => `L${x(i)},${y(m.spot)}`).join(" ")} L${x(s.index)},180Z" fill="url(#gamma-area)"/><path d="${visible.map((m, i) => `${i ? "L" : "M"}${x(i)},${y(m.spot)}`).join(" ")}" fill="none" stroke="#9474ad" stroke-width="2.6"/>${visible.map((m, i) => `<circle cx="${x(i)}" cy="${y(m.spot)}" r="${i === s.index ? 5 : 3}" fill="#9474ad" stroke="#fff" stroke-width="2"/>`).join("")}<text x="735" y="18" text-anchor="end" font-size="10" fill="#8b7f97">仅展示已知价格 · 每回合 1 天</text></svg>`;
}
export function createGammaGame({ openModal, closeModal, toast }) {
  let state = startGame(),
    root = null,
    abort = null,
    records = [],
    pendingKind = "roundtrip",
    nextRules = { ...DEFAULT_RULES },
    evaluation = null;
  try {
    const p = JSON.parse(
      localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY)
    );
    if (p?.nextRules) nextRules = normalizeRules(p.nextRules);
    if (p?.session) state = restoreSession(p.session);
    if (Array.isArray(p?.records))
      records = p.records.slice(-12).filter(r => {
        try {
          return restoreSession(r).complete;
        } catch {
          return false;
        }
      });
  } catch {}
  function persist() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 2,
          nextRules,
          session: serializeSession(state),
          records,
        })
      );
    } catch {
      toast("浏览器未保存本局，关闭页面后进度可能丢失。");
    }
  }
  function view() {
    const m = snapshot(state),
      r = result(state),
      scenario = SCENARIOS.find(s => s.id === state.kind),
      chosen = state.decisions.some(d => d.index === state.index);
    return `<div class="page-heading"><div><div class="eyebrow">GAME 02 / GAMMA SURFER</div><h1>波动率捕手 <span class="title-tag purple-tag">v0.2 · 规则与验证</span></h1><p>把 Delta 放回平衡，让现金账本解释每一次选择。</p></div><div class="top-actions"><button class="outline-button" data-gamma="settings">对冲规则</button><button class="outline-button" data-gamma="evaluate">多路径实验</button><button class="outline-button" data-gamma="records">最近训练</button><button class="outline-button" data-gamma="help">${icon("help", 16)}规则与单位</button></div></div><div class="gamma-scenarios">${SCENARIOS.map(s => `<button data-gamma="scenario" data-kind="${s.id}" class="${state.kind === s.id ? "selected" : ""}"><small>${s.label}</small><b>${s.name}</b></button>`).join("")}</div><div class="gamma-brief"><span>${icon("activity", 20)}</span><div><b>${scenario.name}</b><p>${scenario.description} ${scenario.objective}</p></div><span class="pill">${state.kind === "unknown" ? "新种子 " + state.seed : "已见教学路径"}</span></div><div class="gamma-layout"><section class="panel gamma-market"><div class="panel-heading"><h2>市场观察</h2><span class="tiny-label">${state.complete ? "已结算" : `决策回合 ${state.index + 1} / 8`} · 未来价格隐藏</span></div><div class="gamma-market-values"><span>标的 <b>${money(m.spot)}</b></span><span>剩余期限 <b>${m.days} 天</b></span><span>IV <b>${(m.iv * 100).toFixed(1)}%</b></span></div>${chart(state)}<div class="gamma-risk"><div><span>净 Delta · 标的单位</span><b class="${Math.abs(m.delta) > state.c.threshold ? "risk-alert" : ""}">${m.delta.toFixed(2)}</b></div><div><span>Gamma · 每 $1</span><b>${m.gamma.toFixed(2)}</b></div><div><span>Vega · IV 每 1pp</span><b>${money(m.vega)}</b></div><div><span>Theta · 每天</span><b>${signed(m.theta)}</b></div></div></section><section class="panel gamma-account"><h2>你的账户</h2><div class="account-total"><span>账户权益</span><b>${money(m.equity)}</b><strong class="${m.pnl >= 0 ? "positive" : "negative"}">${signed(m.pnl)}</strong></div><div class="account-lines"><p><span>现金</span><b>${money(m.cash)}</b></p><p><span>标的持仓</span><b>${m.stock.toFixed(4)} 单位</b></p><p><span>期权持仓市值</span><b>${money(m.optionValue)}</b></p><p><span>累计费用与价差</span><b>${money(m.cost)}</b></p></div><p class="muted">开局买入 1 Call + 1 Put，K=100，每腿乘数 100。初始资金 $10,000，建仓成本已入账。</p></section><section class="panel gamma-decisions"><div class="panel-heading"><h2>${state.complete ? "训练已完成" : "选择本回合的对冲动作"}</h2><span class="tiny-label">${state.complete ? "阅读复盘，再挑战另一条路径" : chosen ? "已按当前价格执行" : "一次决策后才能推进市场"}</span></div>${
      state.complete
        ? `<div class="gamma-complete"><span>${icon("trophy", 30)}</span><div><h3>盈亏已经对上账。</h3><p>盈利并不自动代表控制得好；亏损也可能来自时间价值与 IV。</p></div><button class="primary-button" data-gamma="review">打开完整复盘 ${icon("arrow", 16)}</button></div>`
        : `${predictionPanel()}<div class="hedge-actions">${[
            [1, "调至 Delta 中性"],
            [0.5, "减半净 Delta"],
            [0, "保持仓位"],
          ]
            .map(([f, title]) => {
              const q = -m.delta * f;
              return `<button data-gamma="decide" data-fraction="${f}" ${chosen || (QUESTIONS[state.index] && state.learning?.predictions?.[state.index] === undefined) ? "disabled" : ""}><b>${title}</b><span>${f === 0 ? "本回合不调整" : `${q < 0 ? "卖出" : "买入"} ${Math.abs(q).toFixed(4)} 单位标的`}</span><small>预计成本 ${money(Math.abs(q) * m.spot * (state.c.feeRate + state.c.spreadRate))}</small></button>`;
            })
            .join(
              ""
            )}</div><div class="gamma-next"><span>${chosen ? "决策已执行。下一步才会出现新的市场价格。" : "当前净 Delta " + m.delta.toFixed(2) + "；参考区间 ±" + state.c.threshold + " 标的单位。"}</span><button class="primary-button" data-gamma="advance" ${!chosen ? "disabled" : ""}>${state.index === 7 ? "推进并结算" : "推进一天"} ${icon("arrow", 16)}</button></div>`
    }</section></div><section class="panel explain-panel"><div class="panel-heading"><h2>回合记录 · 退出前估值</h2><button class="text-button" data-gamma="ledger">查看现金账本 ${icon("arrow", 14)}</button></div><div class="gamma-log">${state.history.length ? state.history.map((h, i) => `<button data-gamma="record" data-index="${i}"><b>${i + 1}</b><span>${money(h.before.spot)} → ${money(h.after.spot)}</span><span>${["保持", "半对冲", "中性"][h.decision === 0 ? 0 : h.decision === 0.5 ? 1 : 2]}</span><strong class="${h.after.pnl >= 0 ? "positive" : "negative"}">${signed(h.after.pnl)}</strong></button>`).join("") : '<p class="muted">作出第一次选择并推进一天，记录就会出现在这里。</p>'}</div></section><div class="bottom-note">合成教学市场 · Black–Scholes · ACT/365 · 零利率 · 不模拟保证金和强平。Greeks 是解释，现金流水与完整重估负责结算。</div>`;
  }
  function predictionPanel() {
    const q = QUESTIONS[state.index];
    if (!q) return "";
    const selected = state.learning?.predictions?.[state.index];
    return `<section class="prediction-card"><span class="eyebrow">先预测，再决策 · 首次答案保留</span><h3>${q.text}</h3><div class="prediction-options">${q.choices.map((x, i) => `<button data-gamma="predict" data-answer="${i}" ${selected !== undefined ? "disabled" : ""} class="outline-button ${selected === i ? "selected" : ""}">${x}${selected === i ? " · 你的选择" : ""}</button>`).join("")}</div>${selected !== undefined ? `<p class="${selected === q.answer ? "positive" : "negative"}">${selected === q.answer ? "预测符合模型" : "这次预测需要修正"}。${q.why}</p>` : ""}</section>`;
  }
  function reflectionPanel() {
    const p = predictionSummary(state.learning);
    return `<section class="reflection-panel"><h3>把这局，用自己的话解释</h3><p class="muted">首次预测 ${p.correct}/${p.answered} 正确，与净盈亏分别记录。写出一项主要收益/损失来源和一项仍保留的风险。</p><textarea id="gamma-reflection" aria-label="本局复盘解释" maxlength="500" placeholder="例如：Delta 对冲控制了方向暴露，但 IV 下降带来了 Vega 损失。">${esc(state.learning?.reflection || "")}</textarea><button class="outline-button" data-gamma="reflection">保存复盘解释</button></section>`;
  }
  function settings() {
    openModal(
      "对冲规则 · 下局生效",
      `<p class="modal-lead">成本与风险规则在建仓时锁定；保存后用于新局和多路径实验，不重算本局历史。</p><div class="form-grid"><label>净 Delta 阈值（1–100）<input id="g-threshold" type="number" min="1" max="100" value="${nextRules.threshold}"></label><label>定时对冲间隔（1–4 天）<input id="g-interval" type="number" min="1" max="4" value="${nextRules.interval}"></label><label>手续费（0–50 bps）<input id="g-fee" type="number" min="0" max="50" value="${nextRules.feeBps}"></label><label>标的半价差（0–50 bps）<input id="g-spread" type="number" min="0" max="50" value="${nextRules.spreadBps}"></label></div><p class="muted">1 bps = 0.01%。手续费适用于标的成交及期权开仓/提前退出；半价差仅适用于标的。本局锁定阈值 ${state.c.threshold}、手续费 ${state.c.feeRate * 10000}bps、半价差 ${state.c.spreadRate * 10000}bps。</p><button class="primary-button" data-gamma="apply-settings">保存下局规则</button>`,
      true
    );
  }
  function histogram(rows) {
    const values = rows.map(r => r.pnl),
      lo = Math.min(...values),
      hi = Math.max(...values),
      span = hi - lo || 1;
    const bins = Array(8).fill(0);
    for (const v of values)
      bins[Math.min(7, Math.floor(((v - lo) / span) * 8))]++;
    const max = Math.max(...bins, 1);
    return `<svg viewBox="0 0 640 160" role="img" aria-label="阈值策略在本批次路径上的净盈亏分布">${bins.map((n, i) => `<rect x="${30 + i * 73}" y="${120 - (n / max) * 95}" width="58" height="${(n / max) * 95}" rx="4" fill="#a58cbb"/><text x="${59 + i * 73}" y="${110 - (n / max) * 95}" text-anchor="middle" font-size="11">${n}</text>`).join("")}<text x="30" y="146" font-size="11">${signed(lo)}</text><text x="615" y="146" text-anchor="end" font-size="11">${signed(hi)}</text></svg>`;
  }
  function experiment() {
    const names = { none: "不对冲", timed: "定时对冲", threshold: "阈值对冲" };
    openModal(
      "多路径实验 · 先定规则，再看分布",
      `<p class="modal-lead">下一次实验：阈值 ±${nextRules.threshold}，间隔 ${nextRules.interval} 天，手续费 ${nextRules.feeBps}bps，半价差 ${nextRules.spreadBps}bps。</p><p class="muted">每次生成 32 条新种子路径，三个策略使用完全相同的价格、IV、期权和成本。合成日波动率按年化 65% 生成，定价 IV 固定 60%，不代表真实市场或预测。重复看过的批次已成为练习数据，不能继续当作未见验证。</p><div class="modal-actions"><button class="outline-button" data-gamma="settings">修改下次规则</button><button class="primary-button" data-gamma="run-evaluation">运行 32 条新路径</button></div>${evaluation ? `<h3>本批次 ${evaluation.seed} · 32 条路径</h3><p class="muted">已锁定阈值 ${evaluation.rules.threshold} / 间隔 ${evaluation.rules.interval} / 费率 ${evaluation.rules.feeBps}bps / 半价差 ${evaluation.rules.spreadBps}bps。以下是这一批次的结果，不替换手工训练成绩。</p><div class="scroll-table"><table><thead><tr><th>策略</th><th>净盈亏 P10</th><th>中位数</th><th>P90</th><th>平均成本</th><th>平均回撤</th><th>平均区间遵守率</th><th>最大决策后 |Delta|</th></tr></thead><tbody>${evaluation.policies.map(({ policy, stats: a }) => `<tr><td>${names[policy]}</td><td>${signed(a.p10)}</td><td>${signed(a.median)}</td><td>${signed(a.p90)}</td><td>${money(a.meanCost)}</td><td>${money(a.meanDrawdown)}</td><td>${(a.meanRisk * 100).toFixed(1)}%</td><td>${a.worstDelta.toFixed(2)}</td></tr>`).join("")}</tbody></table></div><h3>阈值策略净盈亏分布</h3>${histogram(evaluation.policies[2].rows)}<h3>相同路径的成本敏感性</h3><div class="scroll-table"><table><thead><tr><th>费用和半价差倍数</th><th>净盈亏中位数</th><th>平均成本</th></tr></thead><tbody>${evaluation.sensitivity.map(x => `<tr><td>${x.scale}×</td><td>${signed(x.stats.median)}</td><td>${money(x.stats.meanCost)}</td></tr>`).join("")}</tbody></table></div><p class="muted">成本敏感性沿用同一阈值与路径，包含开仓和最终退出。最大回撤及风险区间仅按观察/决策点计算，32 条路径不能建立统计优势结论。</p><button class="outline-button" data-gamma="export-evaluation">导出批次、规则与逐路径结果</button>` : '<div class="empty-state"><p>先锁定规则，再生成这一批新路径。不要以一条盈利路径判断规则好坏。</p></div>'}`,
      true
    );
  }
  function exportObject(payload, name) {
    if (!payload) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function render() {
    if (root) root.innerHTML = view();
  }
  function ledger() {
    const rows = [
      { name: "初始资金", cash: state.c.capital },
      {
        name: "买入 Call + Put",
        qty: "各 1 张 × 100",
        price: state.initialOption,
        fee: state.initialOption * state.c.feeRate,
        spread: 0,
        cash:
          state.c.capital -
          state.initialOption -
          state.initialOption * state.c.feeRate,
      },
      ...state.trades.map(t => ({
        name: `第 ${t.time} 天${t.closing ? " · 平仓" : ""}`,
        qty: t.qty.toFixed(4),
        price: t.spot,
        fee: t.fee,
        spread: t.spread,
        cash: t.cashAfter,
      })),
      ...(state.complete
        ? [
            {
              name: state.settlement.expiry
                ? "期权到期现金结算"
                : "期权提前退出",
              price: state.settlement.optionValue,
              fee: state.settlement.optionExitFee,
              spread: 0,
              cash: state.cash,
            },
          ]
        : []),
    ];
    openModal(
      "每一笔钱，都有去处",
      `<p class="modal-lead">账户权益 = 现金 + 标的持仓 × 当前价 + 期权市值。</p><div class="scroll-table"><table><thead><tr><th>事件</th><th>数量</th><th>价格/期权总值</th><th>费用</th><th>价差成本</th><th>事件后现金</th></tr></thead><tbody>${rows.map(row => `<tr><td>${row.name}</td><td>${row.qty || "—"}</td><td>${row.price === undefined ? "—" : money(row.price)}</td><td>${money(row.fee || 0)}</td><td>${money(row.spread || 0)}</td><td>${money(row.cash)}</td></tr>`).join("")}</tbody></table></div><p class="muted">标的按中间价计算现金流，并单列半价差成本；期权报价按合约总价值入账。零利率模型允许借入现金或卖空标的，没有额外融资费或保证金占用。</p>`,
      true
    );
  }
  function review() {
    const r = result(state),
      baselines = [
        ["你的操作", r],
        ...[
          ["不对冲", "none"],
          [`每 ${state.c.interval} 天对冲`, "timed"],
          ["阈值对冲", "threshold"],
        ].map(([name, policy]) => [
          name,
          result(runPolicy(state.kind, state.seed, policy, state.c)),
        ]),
      ];
    openModal(
      "波动率捕手 · 本局复盘",
      `<div class="result-banner success"><span>${icon("check", 26)}</span><div><b>现金账本与完整重估${r.reconciled ? "一致" : "存在差异"}</b><p>完成 ${r.turns} 个回合。风险规则和盈亏分别呈现，不按盈利排名。</p></div></div><div class="pnl-breakdown"><div><span>期权价值变化</span><b>${signed(r.optionGross)}</b></div><div><span>标的对冲毛盈亏</span><b>${signed(r.stockGross)}</b></div><div><span>费用 + 价差</span><b>−${money(r.cost)}</b></div><div><span>最终净盈亏</span><b>${signed(r.pnl)}</b></div></div>${reflectionPanel()}<h3>同一条路径、同一组成本规则</h3><div class="scroll-table"><table><thead><tr><th>策略</th><th>净盈亏</th><th>总成本</th><th>决策后最大 |Delta|</th><th>区间遵守率</th><th>观察点最大回撤</th></tr></thead><tbody>${baselines.map(([name, a]) => `<tr><td>${name}</td><td>${signed(a.pnl)}</td><td>${money(a.cost)}</td><td>${a.maxDelta.toFixed(2)}</td><td>${(a.riskAdherence * 100).toFixed(0)}%</td><td>${money(a.drawdown)}</td></tr>`).join("")}</tbody></table></div><p class="muted">区间遵守率：每次决策后、下一段行情开始前，净 Delta 是否位于 ±${state.c.threshold}。即使此时中性，之后的价格跳跃仍可能带来损失。标的最后强制平仓，期权按完整模型价值退出或到期现金结算。</p><div class="modal-actions">${[
        ["不对冲", "none"],
        ["定时对冲", "timed"],
        ["阈值对冲", "threshold"],
      ]
        .map(
          ([n, p]) =>
            `<button class="outline-button" data-gamma="auto-replay" data-policy="${p}">${n}只读回放</button>`
        )
        .join(
          ""
        )}</div><h3>Greeks 近似解释，保留剩余项</h3><div class="attribution">${[...Object.entries(r.approx).map(([k, v]) => [{ direction: "方向暴露", gamma: "Gamma 项", theta: "Theta 项", vega: "Vega 项" }[k], v]), ["近似残差", r.residual]].map(([n, v]) => `<span>${n}<b>${signed(v)}</b></span>`).join("")}</div><p class="muted">上面各项合计为成本前的价格与估值变化。费用在净盈亏里只扣除一次，Gamma 收益不再重复加到账户中。</p><div class="callout">${icon("bulb", 20)}<p>${SCENARIOS.find(s => s.id === state.kind).objective} 试着比较：同样结果下，你付出了多少成本；盈利时是否保留了较大方向暴露。</p></div><div class="modal-actions"><button class="outline-button" data-gamma="ledger">查看完整账本</button><button class="primary-button" data-gamma="export">导出本局</button></div>`,
      true
    );
  }
  function download() {
    const payload = {
      format: "gamma-session",
      version: 2,
      session: serializeSession(state),
      result: result(state),
      trades: state.trades,
      history: state.history,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "gamma-surfer-session.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("本局记录已导出。");
  }
  function onClick(e) {
    const b = e.target.closest("[data-gamma]");
    if (!b || b.disabled) return;
    const d = b.dataset;
    try {
      switch (d.gamma) {
        case "settings":
          settings();
          break;
        case "apply-settings": {
          nextRules = normalizeRules({
            threshold: Number(document.querySelector("#g-threshold").value),
            interval: Number(document.querySelector("#g-interval").value),
            feeBps: Number(document.querySelector("#g-fee").value),
            spreadBps: Number(document.querySelector("#g-spread").value),
          });
          persist();
          closeModal();
          toast(
            "规则已保存；新局及下一次多路径实验使用它。本局规则保持建仓时的值。"
          );
          break;
        }
        case "evaluate":
          experiment();
          break;
        case "run-evaluation":
          evaluation = evaluateRules(
            nextRules,
            crypto.getRandomValues(new Uint32Array(1))[0],
            32
          );
          experiment();
          break;
        case "export-evaluation":
          exportObject(evaluation, "gamma-multipath.json");
          break;
        case "auto-replay": {
          const s = runPolicy(state.kind, state.seed, d.policy, state.c);
          openModal(
            "自动策略只读回放",
            `<p class="modal-lead">${esc(d.policy)} · 相同种子 ${state.seed} · 不计入手工训练</p><div class="gamma-log">${s.history.map((h, i) => `<p>${i + 1}：${money(h.before.spot)} → ${money(h.after.spot)} · ${h.decision ? "中性" : "保持"} · 决策后 Delta ${h.before.delta.toFixed(2)} · 退出前盈亏 ${signed(h.after.pnl)}</p>`).join("")}</div><p>最终净盈亏 ${signed(result(s).pnl)}；总成本 ${money(result(s).cost)}。</p>`,
            true
          );
          break;
        }
        case "predict": {
          if (
            !QUESTIONS[state.index] ||
            state.learning?.predictions?.[state.index] !== undefined
          )
            break;
          const answer = Number(d.answer);
          if (!Number.isInteger(answer) || answer < 0 || answer > 2)
            throw Error("预测选项无效");
          state = {
            ...state,
            learning: {
              predictions: {
                ...(state.learning?.predictions || {}),
                [state.index]: answer,
              },
              reflection: state.learning?.reflection || "",
            },
          };
          persist();
          render();
          break;
        }
        case "reflection": {
          const text = document.querySelector("#gamma-reflection").value.trim();
          if (text.length < 8 || text.length > 500)
            throw Error(
              "请用 8–500 个字解释本局的主要收益或损失来源及一项风险。"
            );
          state = {
            ...state,
            learning: {
              predictions: state.learning?.predictions || {},
              reflection: text,
            },
          };
          const raw = serializeSession(state);
          if (records.length) records[records.length - 1] = raw;
          persist();
          review();
          toast("复盘解释已保存。");
          break;
        }

        case "scenario":
          pendingKind = d.kind;
          openModal(
            "开始新的一局？",
            `<p class="modal-lead">${SCENARIOS.find(s => s.id === d.kind)?.name || ""}。未完成的本局会被替换，已完成记录保留在本浏览器。</p><div class="modal-actions"><button class="outline-button" data-action="close">保留当前局</button><button class="primary-button" data-gamma="start">开始新局</button></div>`
          );
          break;
        case "start": {
          const seed =
            pendingKind === "unknown"
              ? crypto.getRandomValues(new Uint32Array(1))[0]
              : 42;
          state = startGame(pendingKind, seed, engineConfig(nextRules));
          persist();
          closeModal();
          render();
          break;
        }
        case "decide":
          if (
            QUESTIONS[state.index] &&
            state.learning?.predictions?.[state.index] === undefined
          )
            throw Error("先记录本回合的首次预测。");
          state = decide(state, Number(d.fraction));
          persist();
          render();
          break;
        case "advance":
          state = advance(state);
          if (state.complete) {
            records = [...records, serializeSession(state)].slice(-12);
          }
          persist();
          render();
          if (state.complete) review();
          break;
        case "records":
          openModal(
            "最近完成的训练",
            `<p class="muted">本浏览器保留最近 12 局的种子与决策。摘要由记录重新播放核算，不使用外部填入的成绩。</p><div class="scroll-table"><table><thead><tr><th>练习</th><th>种子</th><th>净盈亏</th><th>区间遵守率</th><th>首次预测</th><th>复盘解释</th></tr></thead><tbody>${
              records.length
                ? records
                    .map(raw => {
                      const s = restoreSession(raw),
                        r = result(s);
                      return `<tr><td>${SCENARIOS.find(x => x.id === s.kind).name}</td><td>${s.seed}</td><td>${signed(r.pnl)}</td><td>${(r.riskAdherence * 100).toFixed(0)}%</td><td>${predictionSummary(s.learning).correct}/${predictionSummary(s.learning).answered}</td><td>${esc(s.learning?.reflection || "未填写")}</td></tr>`;
                    })
                    .join("")
                : '<tr><td colspan="6">完成一局后，记录会出现在这里。</td></tr>'
            }</tbody></table></div>`,
            true
          );
          break;
        case "ledger":
          ledger();
          break;
        case "review":
          review();
          break;
        case "export":
          download();
          break;
        case "record": {
          const h = state.history[Number(d.index)];
          if (!h) return;
          openModal(
            "回看这一回合",
            `<p class="modal-lead">${money(h.before.spot)} → ${money(h.after.spot)}，剩余 ${h.after.days} 天。</p><div class="report-summary"><span>决策后 Delta<b>${h.before.delta.toFixed(3)}</b></span><span>新行情后 Delta<b>${h.after.delta.toFixed(3)}</b></span><span>该段权益变化<b>${signed(h.after.equity - h.before.equity)}</b></span></div><p class="muted">动作先按当时的价格执行，然后才发生这一段价格和 IV 变化。此处只读回放，不允许回到旧价格重新成交。</p>`
          );
          break;
        }
        case "help":
          openModal(
            "波动率捕手 · 规则与单位",
            `<div class="guide-steps"><div><b>01</b><span><strong>观察当前信息</strong><p>标的、剩余期限、IV 和组合风险。未来路径在完成前不显示。</p></span></div><div><b>02</b><span><strong>作出一次选择</strong><p>调至中性、减半净 Delta，或保持仓位。先按当前价格执行，再推进一天。</p></span></div><div><b>03</b><span><strong>读懂账本与基准</strong><p>八回合后自动平掉标的并退出或结算期权。比较对冲成本、方向暴露和盈亏。</p></span></div></div><p class="muted">两腿期权乘数各 100，K=100；标的可交易小数单位。本局标的手续费 ${state.c.feeRate * 10000}bps、半价差 ${state.c.spreadRate * 10000}bps，期权按总价值收 ${state.c.feeRate * 10000}bps 费用，期权不另设价差。初始资本 $10,000，ACT/365，r=q=0。Vega 为 IV 每变化一个百分点的美元影响，Theta 为每天，Delta 为标的单位，Gamma 为每 $1 的 Delta 变化。持有期间不允许减掉指定期权敞口。</p><div class="callout">${icon("info", 18)}<p>固定路径用于反复练习；未知行情每次生成新种子。所有计算均在客户端运行，隐藏未来是教学界面约束，不具备排行榜级反作弊。</p></div>`,
            true
          );
          break;
      }
    } catch (error) {
      toast(error.message);
    }
  }
  return {
    mount(el) {
      root = el;
      abort = new AbortController();
      document.addEventListener("click", onClick, { signal: abort.signal });
      render();
    },
    unmount() {
      abort?.abort();
      root = null;
    },
    getState: () => state,
  };
}
