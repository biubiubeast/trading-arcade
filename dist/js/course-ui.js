import {
  normalizePack,
  portablePack,
  portableLesson,
  parseJson,
  createShare,
  readShare,
  importedProgress,
  LIMITS,
} from "./content.js";
import { STARTER_PACK } from "./course-presets.js";
import { MARKET, analyze, pnl } from "./engine.js";
import { icon, money } from "./ui.js";
export const escapeText = s =>
  String(s).replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]
  );
export function runtimeCourse(pack) {
  let clean;
  try {
    clean = normalizePack(portablePack(pack));
  } catch {
    return [];
  }
  return clean.lessons.map(l => {
    let h = 2166136261;
    for (const char of JSON.stringify(portableLesson(l)))
      h = Math.imul(h ^ char.charCodeAt(0), 16777619);
    return { ...l, id: "custom-" + (h >>> 0).toString(16) };
  });
}
export function createContentUI({
  progress,
  builtins,
  getCourse,
  getWorkspace,
  applyPack,
  openCourse,
  applyProgress,
  openModal,
  closeModal,
  toast,
}) {
  let pending = null;
  function download(obj, name) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function view() {
    const pack = getCourse();
    return `<div class="page-heading"><div><div class="eyebrow">COURSE WORKSHOP / PAYOFF PUZZLE v0.3</div><h1>把理解，编成一组任务。</h1><p>导入经过校验的课程包，或把自己的组合分享给下一位学习者。</p></div><button class="outline-button" data-content="input-course">${icon("plus", 16)}导入课程</button></div><div class="course-intro"><div><span class="pill">有限规则 · 确定性验收</span><h2>从积木，到你的课堂。</h2><p>课程任务必须提供通过检验的参考解；小牌库无解题则需要完整枚举证明。先预览、后载入，已有学习记录保留。</p><div class="modal-actions"><button class="primary-button" data-content="starter">载入示例课程 ${icon("arrow", 16)}</button><button class="outline-button" data-content="template">下载课程模板</button></div></div><div class="course-steps"><span><b>01</b>定义工具、市场和任务条件</span><span><b>02</b>验证参考解或完整枚举</span><span><b>03</b>分享组合，重新检验</span></div></div><div class="section-title"><h2>${pack ? escapeText(pack.title) : "当前没有载入课程"}</h2>${pack ? '<button class="text-button" data-content="export-course">导出当前课程包</button>' : ""}</div>${
      pack
        ? `<div class="course-cards">${runtimeCourse(pack)
            .map(
              (l, i) =>
                `<article class="panel course-card"><small>LESSON ${String(i + 1).padStart(2, "0")}</small><h3>${escapeText(l.title)}</h3><p>${escapeText(l.brief)}</p><div><span class="pill">${l.infeasible ? "无解判断" : "组合任务"}</span><button class="outline-button" data-content="open-course" data-index="${i}">开始任务 ${icon("arrow", 15)}</button></div></article>`
            )
            .join("")}</div>`
        : '<section class="panel explain-panel"><p class="muted">示例课程包含预算价差、现金腿复制现货，以及一个不可能订单。你也可以编辑模板 JSON，制作自己的 1–12 题课程。</p></section>'
    }<section class="panel explain-panel"><h2>学习记录与兼容</h2><p class="muted">支持 v0.1、v0.2、v0.3 的期权积木导出文件。导入时重新判题，只合并较高星级、填补空草稿；现有非空草稿、首次预测和波动率捕手记录不会被覆盖。课程包请单独导入，再导入对应任务的进度。</p><button class="outline-button" data-content="input-progress">导入学习记录 ${icon("download", 15)}</button></section><div class="bottom-note">课程和分享链接均在浏览器校验，不运行任意代码，也不改变网站访问权限。</div>`;
  }
  function input(kind) {
    pending = null;
    openModal(
      kind === "course" ? "导入课程包" : "导入学习记录",
      `<p class="modal-lead">粘贴 JSON 或选择本地 JSON 文件，先检查预览，再决定是否载入。</p><textarea class="json-input" id="content-json" aria-label="JSON 内容" placeholder="粘贴 JSON 内容"></textarea><input type="file" id="content-file" accept="application/json,.json" hidden data-kind="${kind}"><div class="modal-actions"><button class="outline-button" data-content="choose-file">选择本地 JSON</button><button class="primary-button" data-content="validate" data-kind="${kind}">校验并预览 ${icon("arrow", 16)}</button></div><p class="muted">单文件上限 250 KB；不支持 HTML、代码或任意公式。错误文件不会写入进度。</p>`,
      true
    );
  }
  function preview(raw, kind) {
    if (kind === "course") {
      const pack = normalizePack(raw);
      pending = { kind, pack };
      openModal(
        "课程已通过校验",
        `<p class="modal-lead">${escapeText(pack.title)} · ${pack.lessons.length} 道任务</p><ul class="import-preview">${pack.lessons.map(l => `<li>${icon("check", 15)}<span>${escapeText(l.title)}</span><b>${l.infeasible ? "枚举 " + l.certificate.checked + " 个节点，无可行组合" : "参考解满足全部条件"}</b></li>`).join("")}</ul><div class="callout">${icon("info", 18)}<p>将替换当前载入的课程包。原课程进度仍保留；基础关、迁移挑战和另一款游戏的数据不受影响。内容改变会使用不同的任务标识。</p></div><div class="modal-actions"><button class="outline-button" data-action="close">取消</button><button class="primary-button" data-content="apply">载入这组课程</button></div>`,
        true
      );
    } else {
      const merged = importedProgress(
        raw,
        [...builtins, ...runtimeCourse(getCourse() || {})],
        progress
      );
      pending = { kind, ...merged };
      openModal(
        "学习记录 · 合并预览",
        `<p class="modal-lead">重新核算完成。预计合并 ${merged.changes.length} 项。</p><ul class="import-preview">${merged.changes.length ? merged.changes.map(s => `<li>${icon("check", 14)}<span>${escapeText(s)}</span></li>`).join("") : "<li>没有需要合并的新成绩或空草稿。</li>"}</ul><p class="muted">保留当前的非空草稿、首次预测及其他游戏记录。取消后不会写入任何数据。</p><div class="modal-actions"><button class="outline-button" data-action="close">取消</button><button class="primary-button" data-content="apply">确认合并</button></div>`,
        true
      );
    }
  }
  function previewShare(encoded) {
    try {
      const item = readShare(encoded);
      pending = { kind: "share", ...item };
      openModal(
        "收到一个教学组合",
        `<p class="modal-lead">${escapeText(item.lesson.title)}</p><p class="muted">来自分享链接的内容。它会作为单题课程载入，替换当前课程包；原有进度保留。载入不等于过关，成绩会重新计算；按示范辅助记录。</p><div class="replay-legs">${item.legs.map(l => `<span class="pill">${l.qty > 0 ? "买入" : "卖出"} ${Math.abs(l.qty)} ${l.type} ${l.strike || ""}</span>`).join("")}</div><div class="modal-actions"><button class="outline-button" data-action="close">取消</button><button class="primary-button" data-content="apply">载入并重新检验</button></div>`
      );
    } catch (e) {
      toast(e.message);
    }
  }
  function share() {
    const { level, legs, market } = getWorkspace();
    if (!legs.length) {
      toast("先搭建一个组合。");
      return;
    }
    let lesson = portableLesson(level);
    lesson.id = "custom-shared";
    if (level.id === "sandbox") {
      lesson = {
        id: "custom-shared",
        title: "自由实验组合",
        topic: "分享与比较",
        brief:
          "这是一个分享的教学组合。情景条件只用于重新检验，不表示策略适合真实交易。",
        types: level.types,
        strikes: level.strikes,
        sell: true,
        maxUnits: 8,
        market,
        goals: [
          {
            kind: "scenario",
            spot: market.spot,
            limit: pnl(legs, market.spot, 0, undefined, market),
            op: "gte",
          },
        ],
        solution: legs,
      };
    }
    lesson.market = market;
    const code = createShare(lesson, legs),
      url = location.origin + location.pathname + "#share=" + code;
    openModal(
      "分享你的组合",
      `<p class="modal-lead">链接携带任务和持仓，不包含你的学习记录。</p><textarea class="json-input short" id="share-url" aria-label="组合分享链接" readonly>${escapeText(url)}</textarea><p class="muted">接收者仍需要网站访问权限。链接不会公开私有网站，也不会自动导入或授予成绩。</p><button class="primary-button" data-content="copy-share">复制链接 ${icon("external", 15)}</button>`
    );
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-content]");
    if (!b || b.disabled) return;
    const d = b.dataset;
    try {
      switch (d.content) {
        case "starter":
          preview(STARTER_PACK, "course");
          break;
        case "template":
          download(STARTER_PACK, "payoff-course-template.json");
          break;
        case "export-course":
          download(portablePack(getCourse()), "payoff-course.json");
          break;
        case "input-course":
          input("course");
          break;
        case "input-progress":
          input("progress");
          break;
        case "choose-file":
          document.querySelector("#content-file").click();
          break;
        case "validate":
          preview(
            parseJson(document.querySelector("#content-json").value),
            d.kind
          );
          break;
        case "open-course":
          openCourse(Number(d.index));
          break;
        case "share":
          share();
          break;
        case "copy-share": {
          const el = document.querySelector("#share-url");
          if (navigator.clipboard)
            navigator.clipboard.writeText(el.value).then(
              () => toast("链接已复制。"),
              () => {
                el.focus();
                el.select();
                toast("请复制已选中的链接。");
              }
            );
          else {
            el.focus();
            el.select();
            toast("请复制已选中的链接。");
          }
          break;
        }
        case "apply": {
          if (!pending) break;
          const p = pending;
          pending = null;
          closeModal();
          if (p.kind === "course") applyPack(p.pack);
          else if (p.kind === "progress") applyProgress(p.next);
          else {
            const pack = {
              format: "arcade-course",
              version: 1,
              id: "custom-shared-pack",
              title: "分享的教学任务",
              lessons: [portableLesson(p.lesson)],
            };
            applyPack(pack, p.legs);
          }
          break;
        }
      }
    } catch (error) {
      toast(error.message);
    }
  });
  document.addEventListener("change", async e => {
    if (e.target.id !== "content-file") return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > LIMITS.json) throw Error("文件超过 250 KB");
      preview(parseJson(await file.text()), e.target.dataset.kind);
    } catch (error) {
      toast(error.message);
    }
  });
  return { view, previewShare };
}
