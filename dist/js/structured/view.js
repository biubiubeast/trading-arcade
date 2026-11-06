import {
  CASES,
  getCase,
  evaluateDesign,
  validateSubmission,
  normalizeDesign,
  payment,
} from "./engine.js";
import { icon, money, signed } from "../ui.js";
const KEY = "trade-arcade:structured:v1";
const esc = s =>
  String(s ?? "").replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]
  );
export function readStructured(storage) {
  const fresh = {
    version: 1,
    selected: "participation",
    drafts: {},
    completed: {},
  };
  try {
    const p = JSON.parse(storage.getItem(KEY));
    if (p?.version !== 1) return fresh;
    for (const c of CASES) {
      try {
        if (p.drafts?.[c.id])
          fresh.drafts[c.id] = normalizeDesign(c.id, p.drafts[c.id]);
        if (p.completed?.[c.id]) {
          const x = p.completed[c.id];
          validateSubmission(c.id, x.design, x);
          fresh.completed[c.id] = x;
        }
      } catch {}
    }
    if (CASES.some(c => c.id === p.selected)) fresh.selected = p.selected;
  } catch {}
  return fresh;
}
export function createStructuredGame({ openModal, closeModal, toast }) {
  let storage;
  try {
    storage = localStorage;
  } catch {
    storage = {
      getItem: () => null,
      setItem: () => {
        throw Error("denied");
      },
    };
  }
  let root = null,
    abort = null,
    store = readStructured(storage),
    id = store.selected,
    design = store.drafts[id] || { ...getCase(id).defaults },
    spot = 100,
    clarified = false,
    answer = null,
    explanation = "";
  function persist() {
    store.selected = id;
    store.drafts[id] = design;
    try {
      storage.setItem(KEY, JSON.stringify(store));
    } catch {
      toast("浏览器未保存工坊记录，请导出备份。");
    }
  }
  function plot() {
    const w = 650,
      h = 240,
      x = s => 48 + (s / 180) * 575,
      scale = Math.max(210, payment(id, design, 180) + 15),
      y = v => 200 - (v / scale) * 170;
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="客户到期支付和初始财富对照，显示标的 0 至 180 美元"><line x1="48" x2="623" y1="${y(100)}" y2="${y(100)}" stroke="#c3b5a1" stroke-dasharray="5 4"/><text x="620" y="${y(100) - 6}" text-anchor="end" font-size="11" fill="#9e8d76">初始财富 $100</text>${[
      0, 0.25, 0.5, 0.75, 1,
    ]
      .map(v => v * scale)
      .map(
        v =>
          `<line x1="48" x2="623" y1="${y(v)}" y2="${y(v)}" stroke="#ece8df"/><text x="38" y="${y(v) + 4}" text-anchor="end" font-size="10">${v.toFixed(0)}</text>`
      )
      .join(
        ""
      )}<path d="${Array.from({ length: 181 }, (_, s) => `${s ? "L" : "M"}${x(s)},${y(payment(id, design, s))}`).join(" ")}" stroke="#b58b55" fill="none" stroke-width="3"/><circle cx="${x(Math.min(180, spot))}" cy="${y(payment(id, design, Math.min(180, spot)))}" r="5" fill="#b58b55"/>${[0, 50, 100, 150, 180].map(s => `<text x="${x(s)}" y="222" text-anchor="middle" font-size="10">${s}</text>`).join("")}</svg>`;
  }
  function fields() {
    const f = (key, label, min, max, step, value) =>
      `<label>${label}<input data-structure-field="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
    return id === "participation"
      ? f("floor", "到期本金底线（$）", 0, 100, 1, design.floor) +
          f(
            "participation",
            "上涨参与率（倍数，0.8 = 80%）",
            0,
            2,
            0.1,
            design.participation
          )
      : id === "income"
        ? f("coupon", "30 天全期票息（%，不是年化）", 0, 10, 0.5, design.coupon)
        : f("putStrike", "买入 Put 执行价", 80, 100, 1, design.putStrike) +
          f("callStrike", "卖出 Call 执行价", 100, 130, 1, design.callStrike);
  }
  function view() {
    const c = getCase(id),
      r = evaluateDesign(id, design, spot),
      done = Object.keys(store.completed).length;
    return `<div class="page-heading"><div><div class="eyebrow">GAME 03 / STRUCTURED STUDIO</div><h1>结构化产品工坊 <span class="title-tag amber-tag">v0.1 · 条款与账本</span></h1><p>先理解客户，再为每一项承诺找到资金来源。</p></div><button class="outline-button" data-structured="records">设计档案 ${done}/3</button></div><div class="studio-cases">${CASES.map(c => `<button class="${c.id === id ? "selected" : ""}" data-structured="case" data-id="${c.id}"><small>${c.tag}</small><b>${c.name}</b>${store.completed[c.id] ? icon("check", 16) : ""}</button>`).join("")}</div><div class="studio-layout"><section class="panel studio-client"><span class="eyebrow">客户委托</span><h2>${c.name}</h2><p>${c.brief}</p><ul class="task-list">${c.requirements.map(x => `<li>${icon("target", 15)}${x}</li>`).join("")}</ul><button class="outline-button" data-structured="clarify">${clarified ? "重新阅读客户信息" : "澄清客户信息"}</button>${clarified ? `<p class="client-answer">${c.clarify}</p>` : ""}<div class="callout"><p>${c.risk}</p></div><p class="muted">合成市场 S₀=$100，30 天，IV 40%，零利率，乘数 1。只在到期观察；每单位期权执行费 $0.10。现金不计息，已有现货不重复收费。</p></section><section class="panel studio-builder"><div class="panel-heading"><h2>设计产品条款</h2><span class="pill">${r.checks.filter(x => x.pass).length}/3 条件通过</span></div><div class="form-grid">${fields()}</div><button class="outline-button" data-structured="update">更新预算与曲线</button><p class="muted">本版按所选标准结构生成复制资产；你负责预算和客户条款之间的取舍。无障碍或自动赎回机制。</p><div class="constraint-list">${r.checks.map(x => `<div class="${x.pass ? "passed" : ""}">${icon(x.pass ? "check" : "circle", 16)}<span>${x.label}</span><b>${x.actual.toFixed(2)}</b></div>`).join("")}</div><div class="studio-funding"><span>${id === "collar" ? "额外投入需求" : "发行方初始留存现金"}</span><b class="${(id === "collar" ? r.cash : r.margin) < -1e-7 ? "negative" : "positive"}">${money(id === "collar" ? Math.max(0, -r.cash) : r.margin)}</b><small>${id === "collar" ? "客户已有现货仍在客户账户，新增付款预算为零。" : r.margin < 0 ? "预算缺口：尚不可发行，不假设免费融资。" : "留存来自客户价格与复制成本之差；不是客户亏损的相反数。"}</small></div><button class="text-button" data-structured="reference">查看一种可行设计（辅助）</button></section><section class="panel studio-chart"><div class="panel-heading"><h2>客户到期支付</h2><span class="tiny-label">支付与净收益分开</span></div>${plot()}<div class="scenario-row"><label for="studio-spot">情景标的价 ${money(spot)}</label><input id="studio-spot" type="range" min="0" max="180" step="1" value="${spot}"></div><div class="report-summary"><span>到期支付 / 财富<b>${money(r.payoff)}</b></span><span>相对初始 $100 净收益<b>${signed(r.customerPnl)}</b></span><span>完整区间最低支付<b>${money(r.minPayoff)}</b></span></div></section><section class="panel studio-ledger"><div class="panel-heading"><h2>${id === "collar" ? "客户与执行柜台" : "客户与发行方"}双面账本</h2><button class="text-button" data-structured="ledger">展开核算</button></div><div class="asset-list">${r.legs.map(l => `<p><span>${l.type === "cash" ? "现金（美元）" : `${l.qty > 0 ? "持有" : "卖出"} ${l.type.toUpperCase()} ${l.strike ? "K" + l.strike : ""}`}</span><b>${l.type === "cash" ? money(l.qty) : Math.abs(l.qty).toFixed(2) + " 单位"}</b></p>`).join("")}</div><p class="accounting-note">${id === "collar" ? `期权净价格 ${signed(r.assetCost)} + 执行费 ${money(r.fee)}；客户保留现金 ${signed(r.cash)}。` : `复制资产价格 ${money(r.assetCost)} + 执行费 ${money(r.fee)} + 留存 ${signed(r.margin)} = 客户支付 $100。`}</p><div class="account-lines"><p><span>${id === "collar" ? "执行柜台净权益" : "发行方到期净权益"}</span><b>${signed(r.issuerPnl)}</b></p><p><span>客户到期净收益</span><b>${signed(r.customerPnl)}</b></p></div><p class="muted">完整风险检查包含 S=0、所有执行价和右端尾部。保护假设发行方履约；未模拟信用违约、提前退出或真实报价。</p></section></div><section class="panel explain-panel"><h2>交付前，说清收益与风险</h2><p>${c.quiz.text}</p><div class="prediction-options">${c.quiz.choices.map((x, i) => `<button class="outline-button ${answer === i ? "selected" : ""}" data-structured="answer" data-answer="${i}">${x}</button>`).join("")}</div><label class="reflection-panel">设计解释（8–500 字）<textarea id="studio-explanation" maxlength="500" placeholder="收益从哪里来？客户接受了什么代价？">${esc(explanation)}</textarea></label><button class="primary-button" data-structured="submit">验收并保存设计 ${icon("arrow", 16)}</button></section>`;
  }
  function render() {
    if (root) root.innerHTML = view();
  }
  function ledger() {
    const r = evaluateDesign(id, design, spot);
    openModal(
      "双面账本 · 每笔资金的去处",
      `<p class="modal-lead">${getCase(id).tag} · 标的到期 ${money(spot)}</p>${id === "collar" ? "<p>客户原来持有 1 现货，新增付款为零。买 Put、卖 Call 的净权利金先扣执行费，余额留在客户现金账户；柜台向外部市场执行对应交易，净权益为零。现货未转移给发行人。</p>" : `<div class="scroll-table"><table><thead><tr><th>建仓资金用途</th><th>金额</th></tr></thead><tbody><tr><td>客户付给发行方</td><td>$100.00</td></tr><tr><td>复制资产净成本</td><td>${money(r.assetCost)}</td></tr><tr><td>第三方执行费</td><td>${money(r.fee)}</td></tr><tr><td>发行方留存现金</td><td>${signed(r.margin)}</td></tr></tbody></table></div><p>到期复制资产支付 ${money(r.payoff)}，同时履行客户负债 ${money(r.payoff)}。发行方净权益 ${signed(r.issuerPnl)}，并不是客户净收益 ${signed(-r.customerPnl)} 的自动相反数。</p>`}<div class="report-summary"><span>客户净收益<b>${signed(r.customerPnl)}</b></span><span>${id === "collar" ? "执行柜台" : "发行方"}净权益<b>${signed(r.issuerPnl)}</b></span><span>执行费用接收方<b>${money(r.fee)}</b></span></div><p class="muted">按相同初始价值基准计入外部市场对手方变化 ${signed(r.marketPnl)} 后，代数合计 ${signed(r.conservation)}。这是简化市场核算，不是实际市场中所有参与者的财富追踪。</p>`,
      true
    );
  }
  function collectFields() {
    const fields = root?.querySelectorAll("[data-structure-field]");
    if (!fields?.length) return;
    const next = { ...design };
    for (const field of fields)
      next[field.dataset.structureField] =
        field.value.trim() === "" ? NaN : Number(field.value);
    design = normalizeDesign(id, next);
    persist();
  }
  function onClick(e) {
    const b = e.target.closest("[data-structured]");
    if (!b) return;
    try {
      if (document.querySelector("#studio-explanation"))
        explanation = document.querySelector("#studio-explanation").value;
      const d = b.dataset;
      if (!["case", "reference", "export", "records"].includes(d.structured))
        collectFields();
      switch (d.structured) {
        case "update":
          render();
          break;
        case "case":
          persist();
          id = d.id;
          design = store.drafts[id] || { ...getCase(id).defaults };
          clarified = false;
          answer = null;
          explanation = "";
          spot = 100;
          persist();
          render();
          break;
        case "clarify":
          clarified = true;
          render();
          break;
        case "answer":
          answer = Number(d.answer);
          render();
          break;
        case "reference":
          design = { ...getCase(id).reference };
          persist();
          render();
          toast("已载入辅助设计，提交时仍需解释资金来源和风险。");
          break;
        case "ledger":
          ledger();
          break;
        case "submit": {
          const r = validateSubmission(id, design, {
            clarified,
            answer,
            explanation,
          });
          store.completed[id] = {
            design: { ...design },
            clarified,
            answer,
            explanation: r.explanation,
          };
          persist();
          render();
          openModal(
            "客户条款与预算均通过",
            `<div class="result-banner success">${icon("check", 24)}<p>这份设计已保存。到期支付与客户净收益分开核算；保护不等于无信用风险。</p></div><p>${esc(r.explanation)}</p><div class="modal-actions"><button class="outline-button" data-structured="export">导出设计档案</button><button class="primary-button" data-action="close">继续探索</button></div>`
          );
          break;
        }
        case "records":
          openModal(
            "设计档案",
            `<div class="journey-list">${CASES.map(c => `<p><b>${c.name}</b> · ${store.completed[c.id] ? "已通过并保存解释" : "尚未交付"}</p>`).join("")}</div><button class="outline-button" data-structured="export">导出全部设计记录</button>`
          );
          break;
        case "export": {
          const url = URL.createObjectURL(
            new Blob(
              [
                JSON.stringify(
                  { format: "structured-studio", version: 1, ...store },
                  null,
                  2
                ),
              ],
              { type: "application/json" }
            )
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = "structured-studio.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          break;
        }
      }
    } catch (err) {
      toast(err.message);
    }
  }
  function onChange(e) {
    try {
      if (e.target.id === "studio-spot") {
        spot = Number(e.target.value);
        if (document.querySelector("#studio-explanation"))
          explanation = document.querySelector("#studio-explanation").value;
        render();
      }
    } catch (err) {
      toast(err.message);
      render();
    }
  }
  return {
    mount(el) {
      root = el;
      abort = new AbortController();
      document.addEventListener("click", onClick, { signal: abort.signal });
      document.addEventListener("input", onChange, { signal: abort.signal });
      render();
    },
    unmount() {
      try {
        collectFields();
      } catch {}
      if (document.querySelector("#studio-explanation"))
        explanation = document.querySelector("#studio-explanation").value;
      abort?.abort();
      persist();
      root = null;
    },
  };
}
