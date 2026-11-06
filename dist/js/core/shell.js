import { icon } from "../ui.js";
export function shell({ route, completed, main }) {
  const active = [
    "play",
    "gamma",
    "structured",
    "games",
    "courses",
    "learn",
    "roadmap",
    "progress",
  ].includes(route)
    ? route
    : "play";
  const names = {
    play: "期权积木",
    gamma: "波动率捕手",
    structured: "结构化产品工坊",
    games: "游戏大厅",
    courses: "课程工坊",
    learn: "知识手册",
    roadmap: "开发路线图",
    progress: "我的进度",
  };
  const link = (id, i, name, extra = "") =>
    `<a href="#${id}" class="nav-item ${active === id ? "active" : ""}">${icon(i)}${name}${extra}</a>`;
  return `<aside class="sidebar"><a class="brand" href="#games" aria-label="交易游乐场 · 游戏大厅"><span class="brand-mark">${icon("blocks", 23)}</span><span>交易游乐场<small>TRADE ARCADE</small></span></a><div class="nav-caption">把知识，玩成直觉。</div><nav aria-label="主导航">${link("games", "grid", "游戏大厅")}<div class="nav-section">正在探索</div>${link("play", "blocks", "期权积木", '<span class="nav-count">v0.4</span>')}${link("gamma", "activity", "波动率捕手", '<span class="nav-dot"></span>')}${link("structured", "shield", "结构化产品工坊")}${link("courses", "book", "课程工坊")}${link("learn", "bulb", "知识手册")}${link("progress", "trophy", "我的进度", `<span class="nav-count">${completed}/6</span>`)}<div class="nav-section">继续生长</div>${link("roadmap", "map", "开发路线图")}</nav><div class="sidebar-bottom"><div class="mini-blocks"><i></i><i></i><i></i><i></i></div><h4>理解结构，<br>也管理过程。</h4><p>从一条曲线，<br>走向一段风险路径。</p><span class="version">EARLY ACCESS <b>v0.4</b></span></div><div class="sidebar-foot"><span class="status-dot"></span> 本地保存学习进度</div></aside><div class="content"><header class="topbar"><div class="breadcrumbs">交易游乐场 ${icon("chevron", 13)} <span>${names[active]}</span></div><div class="top-actions"><a class="text-button" href="#courses">${icon("book", 17)}<span>课程与分享</span></a><span class="top-divider"></span><span class="avatar">N</span><span class="rank">${completed === 6 ? "积木探索家" : "交易学习者"}</span></div></header><main id="main" tabindex="-1">${main}</main><footer class="page-footer"><span>小步试错，大步理解。</span><span>教学模拟 · 合成价格 · 不连接真实交易</span></footer></div>`;
}
