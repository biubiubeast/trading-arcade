import { portablePack } from "./content.js";
const esc = s =>
  String(s ?? "").replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]
  );
const input = (name, label, value, type = "text", extra = "") =>
  `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const select = (name, label, value, choices) =>
  `<label>${label}<select name="${name}">${choices.map(([v, t]) => `<option value="${v}" ${v === value ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
const kinds = [
  ["debit", "初始净支出"],
  ["loss", "最大损失"],
  ["scenario", "到期净损益"],
  ["payoff", "到期支付"],
  ["tailSlope", "右端斜率"],
];
export function editorView(pack, index = 0) {
  const l = pack.lessons[index];
  return `<form id="course-editor" data-lesson="${index}" novalidate><div class="callout"><p>编辑副本。校验与预览通过后才保存课程新版本；原版本和学习记录保留。普通题须提供通过全部条件的参考组合。</p></div><div class="form-grid">${input("pack-id", "课程 ID（custom- 开头）", pack.id)}${input("pack-title", "课程名称", pack.title)}</div><div class="editor-toolbar"><label>编辑任务<select name="lesson-index" data-editor="select-lesson">${pack.lessons.map((x, i) => `<option value="${i}" ${i === index ? "selected" : ""}>${i + 1}. ${esc(x.title)}</option>`).join("")}</select></label><button type="button" class="outline-button" data-editor="add-lesson">添加任务</button><button type="button" class="outline-button" data-editor="remove-lesson" ${pack.lessons.length === 1 ? "disabled" : ""}>移除此题</button></div><div class="form-grid">${input("id", "任务 ID", l.id)}${input("title", "任务名称", l.title)}${input("topic", "学习概念", l.topic)}<label>任务说明<textarea name="brief">${esc(l.brief)}</textarea></label><label>提示<textarea name="hint">${esc(l.hint)}</textarea></label><label>完成后的解释<textarea name="lesson">${esc(l.lesson)}</textarea></label></div><h3>市场与工具</h3><div class="form-grid">${input("spot", "初始标的价", l.market.spot, "number", 'step="0.01"')}${input("days", "期限（天）", l.market.days, "number")}${input("vol", "IV（%）", l.market.vol * 100, "number", 'step="0.1"')}${input("fee", "每净持仓单位费用", l.market.fee, "number", 'step="0.01"')}${input("strikes", "执行价（逗号分隔）", l.strikes.join(", "))}${input("maxUnits", "最多整数单位（1–8）", l.maxUnits, "number")}</div><div class="checkbox-row">${[
    ["call", "Call"],
    ["put", "Put"],
    ["stock", "现货"],
    ["cash", "现金 $10"],
  ]
    .map(
      ([t, n]) =>
        `<label><input type="checkbox" name="types" value="${t}" ${l.types.includes(t) ? "checked" : ""}>${n}</label>`
    )
    .join(
      ""
    )}<label><input type="checkbox" name="sell" ${l.sell ? "checked" : ""}>允许卖出</label><label><input type="checkbox" name="infeasible" ${l.infeasible ? "checked" : ""}>小牌库无解题</label></div><h3>任务条件</h3><p class="muted">支付不扣成本，净损益扣初始支出与费用。情景价格仅适用于到期支付/净损益。</p><div id="editor-goals">${l.goals
    .map(
      (g, i) =>
        `<div class="editor-row" data-goal-row>${select("g-kind", "指标", g.kind, kinds)}${select(
          "g-op",
          "条件",
          g.op,
          [
            ["lte", "≤"],
            ["gte", "≥"],
          ]
        )}${input("g-limit", "数值", g.limit, "number", 'step="any"')}${input("g-spot", "情景价格", g.spot ?? l.market.spot, "number", 'step="any"')}<button type="button" class="text-button" data-editor="remove-goal" data-index="${i}" aria-label="移除条件 ${i + 1}">移除</button></div>`
    )
    .join(
      ""
    )}</div><button type="button" class="outline-button" data-editor="add-goal">添加条件</button><h3>参考组合</h3><p class="muted">数量为带方向的非零整数，卖出用负数。现货/现金的执行价填 0。无解题会忽略参考组合并完整枚举限定工具空间。</p><div id="editor-legs">${(
    l.solution || []
  )
    .map(
      (x, i) =>
        `<div class="editor-row" data-leg-row>${select(
          "l-type",
          "工具",
          x.type,
          [
            ["call", "Call"],
            ["put", "Put"],
            ["stock", "现货"],
            ["cash", "现金"],
          ]
        )}${input("l-strike", "执行价", x.strike, "number", 'step="any"')}${input("l-qty", "数量", x.qty, "number")}<button type="button" class="text-button" data-editor="remove-leg" data-index="${i}" aria-label="移除参考腿 ${i + 1}">移除</button></div>`
    )
    .join(
      ""
    )}</div><button type="button" class="outline-button" data-editor="add-leg">添加参考腿</button><p id="editor-error" class="negative" role="alert"></p><div class="modal-actions"><button type="button" class="outline-button" data-editor="save-draft">保存编辑草稿</button><button type="button" class="primary-button" data-editor="validate">校验并预览课程</button></div></form>`;
}
export function readEditor(form, pack) {
  const number = x => (String(x ?? "").trim() === "" ? NaN : Number(x));
  const out = structuredClone(portablePack(pack)),
    d = new FormData(form),
    i = Number(form.dataset.lesson),
    l = out.lessons[i];
  out.id = d.get("pack-id");
  out.title = d.get("pack-title");
  for (const k of ["id", "title", "topic", "brief", "hint", "lesson"])
    l[k] = d.get(k);
  l.market = {
    spot: number(d.get("spot")),
    days: number(d.get("days")),
    vol: number(d.get("vol")) / 100,
    fee: number(d.get("fee")),
    multiplier: 1,
  };
  l.strikes = String(d.get("strikes"))
    .split(/[,，]/)
    .filter(x => x.trim())
    .map(Number);
  l.types = d.getAll("types");
  l.sell = d.has("sell");
  l.maxUnits = number(d.get("maxUnits"));
  l.infeasible = d.has("infeasible");
  l.goals = [...form.querySelectorAll("[data-goal-row]")].map(row => {
    const get = n => row.querySelector(`[name="${n}"]`).value;
    const kind = get("g-kind");
    return {
      kind,
      op: get("g-op"),
      limit: number(get("g-limit")),
      ...(["scenario", "payoff"].includes(kind)
        ? { spot: number(get("g-spot")) }
        : {}),
    };
  });
  if (l.infeasible) delete l.solution;
  else
    l.solution = [...form.querySelectorAll("[data-leg-row]")].map(row => {
      const get = n => row.querySelector(`[name="${n}"]`).value;
      return {
        type: get("l-type"),
        strike: number(get("l-strike")),
        qty: number(get("l-qty")),
      };
    });
  return out;
}
