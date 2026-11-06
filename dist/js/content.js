import { MARKET, checkLevel, analyze, pnl, mergeLeg } from "./engine.js";
import { validDraft } from "./storage.js";
const TYPES = ["call", "put", "stock", "cash"],
  KINDS = ["debit", "loss", "scenario", "payoff", "tailSlope"];
export const LIMITS = Object.freeze({
  json: 250000,
  share: 18000,
  lessons: 12,
});
const plain = x =>
  x &&
  typeof x === "object" &&
  !Array.isArray(x) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(x));
function object(x, keys) {
  if (!plain(x) || Object.keys(x).some(k => !keys.includes(k)))
    throw Error("结构包含未知字段");
  return x;
}
function text(x, max = 120) {
  if (typeof x !== "string" || !x.trim() || x.length > max)
    throw Error("文字为空或过长");
  return x.trim();
}
function num(x, min, max) {
  if (!Number.isFinite(x) || x < min || x > max)
    throw Error("数值超出允许范围");
  return x;
}
const id = x => {
  if (typeof x !== "string" || !/^custom-[a-z0-9-]{1,40}$/.test(x))
    throw Error("任务 ID 必须以 custom- 开头，只能使用小写字母、数字、短横线");
  return x;
};
export function parseJson(raw, max = LIMITS.json) {
  if (typeof raw !== "string" || new TextEncoder().encode(raw).length > max)
    throw Error("文件过大");
  try {
    return JSON.parse(raw, (key, v) => {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw Error();
      return v;
    });
  } catch {
    throw Error("JSON 格式无效或包含保留字段");
  }
}
export function normalizeLesson(raw) {
  object(raw, [
    "id",
    "title",
    "topic",
    "brief",
    "hint",
    "lesson",
    "types",
    "strikes",
    "sell",
    "maxUnits",
    "market",
    "goals",
    "solution",
    "infeasible",
  ]);
  const lesson = {
    id: id(raw.id),
    title: text(raw.title, 60),
    topic: text(raw.topic, 60),
    brief: text(raw.brief, 1000),
    hint: text(raw.hint || "观察成本、执行价与最大风险之间的关系。", 500),
    lesson: text(
      raw.lesson || "把每个条件与实际数值对应，再解释组合的取舍。",
      1000
    ),
    difficulty: "课程",
    time: "5 分钟",
    concept: "课程任务 · 独立核算",
  };
  if (
    !Array.isArray(raw.types) ||
    !raw.types.length ||
    raw.types.length > 4 ||
    new Set(raw.types).size !== raw.types.length ||
    raw.types.some(t => !TYPES.includes(t))
  )
    throw Error("工具类型无效");
  if (
    !Array.isArray(raw.strikes) ||
    !raw.strikes.length ||
    raw.strikes.length > 7 ||
    new Set(raw.strikes).size !== raw.strikes.length
  )
    throw Error("执行价列表无效");
  lesson.types = [...raw.types];
  lesson.strikes = raw.strikes.map(k => num(k, 1, 1000)).sort((a, b) => a - b);
  if (typeof raw.sell !== "boolean" || !Number.isInteger(raw.maxUnits))
    throw Error("方向或单位限制无效");
  lesson.sell = raw.sell;
  lesson.maxUnits = num(raw.maxUnits, 1, 8);
  const m = object(raw.market || MARKET, [
    "spot",
    "days",
    "vol",
    "fee",
    "multiplier",
  ]);
  lesson.market = {
    spot: num(m.spot, 10, 500),
    days: num(m.days, 1, 365),
    vol: num(m.vol, 0.05, 2),
    fee: num(m.fee, 0, 20),
    multiplier: 1,
  };
  if (m.multiplier !== undefined && m.multiplier !== 1)
    throw Error("当前课程只支持乘数 1");
  if (!Array.isArray(raw.goals) || !raw.goals.length || raw.goals.length > 12)
    throw Error("任务条件必须为 1–12 条");
  lesson.goals = raw.goals.map(g => {
    object(g, ["kind", "limit", "op", "spot"]);
    if (!KINDS.includes(g.kind) || !["lte", "gte"].includes(g.op))
      throw Error("条件类型无效");
    const out = { kind: g.kind, limit: num(g.limit, -10000, 10000), op: g.op };
    if (["scenario", "payoff"].includes(g.kind))
      out.spot = num(g.spot, 0, 2000);
    return out;
  });
  if (raw.infeasible !== undefined && typeof raw.infeasible !== "boolean")
    throw Error("不可行标记无效");
  lesson.infeasible = !!raw.infeasible;
  if (lesson.infeasible) {
    if (raw.solution !== undefined) throw Error("不可行任务不能带参考解");
    if (
      lesson.maxUnits > 2 ||
      lesson.types.length > 2 ||
      lesson.strikes.length > 3
    )
      throw Error("不可行证明仅支持小牌库：至多 2 类工具、3 个执行价、2 单位");
    const certificate = enumerate(lesson);
    if (certificate.feasible) throw Error("声称无解的任务存在可行组合");
    lesson.certificate = certificate;
  } else {
    lesson.solution = validDraft(raw.solution, lesson);
    if (!lesson.solution.length || !checkLevel(lesson, lesson.solution).pass)
      throw Error("参考组合不满足任务条件");
  }
  return lesson;
}
export function normalizePack(raw) {
  object(raw, ["format", "version", "id", "title", "lessons"]);
  if (raw.format !== "arcade-course" || raw.version !== 1)
    throw Error("不支持的课程格式或版本");
  const result = {
    format: "arcade-course",
    version: 1,
    id: id(raw.id),
    title: text(raw.title, 80),
  };
  if (
    !Array.isArray(raw.lessons) ||
    !raw.lessons.length ||
    raw.lessons.length > LIMITS.lessons
  )
    throw Error("课程必须为 1–12 道任务");
  result.lessons = raw.lessons.map(normalizeLesson);
  if (new Set(result.lessons.map(l => l.id)).size !== result.lessons.length)
    throw Error("课程任务 ID 重复");
  return result;
}
export function portableLesson(l) {
  const keys = [
    "id",
    "title",
    "topic",
    "brief",
    "hint",
    "lesson",
    "types",
    "strikes",
    "sell",
    "maxUnits",
    "market",
    "goals",
    "solution",
    "infeasible",
  ];
  return Object.fromEntries(
    keys.filter(k => l[k] !== undefined).map(k => [k, l[k]])
  );
}
export function portablePack(p) {
  return { ...p, lessons: p.lessons.map(portableLesson) };
}
export function enumerate(lesson) {
  const instruments = lesson.types.flatMap(type =>
    ["call", "put"].includes(type)
      ? lesson.strikes.map(strike => ({ type, strike }))
      : [{ type, strike: 0 }]
  );
  const candidates = [];
  let checked = 0,
    solution = null;
  function visit(index, used, legs) {
    if (++checked > 100000) throw Error("枚举空间过大");
    if (index === instruments.length) {
      if (checkLevel(lesson, legs).pass) {
        solution = legs.map(l => ({ ...l }));
        return true;
      }
      return false;
    }
    for (
      let q = lesson.sell ? -(lesson.maxUnits - used) : 0;
      q <= lesson.maxUnits - used;
      q++
    ) {
      const next = q ? [...legs, { ...instruments[index], qty: q }] : legs;
      if (visit(index + 1, used + Math.abs(q), next)) return true;
    }
    return false;
  }
  visit(0, 0, []);
  return {
    feasible: !!solution,
    solution,
    checked,
    scope: "当前离散工具、整数单位和数量上限内的完整枚举",
  };
}
function encode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function decode(s) {
  if (s.length > LIMITS.share || !/^[a-zA-Z0-9_-]+$/.test(s))
    throw Error("分享内容过大或格式错误");
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return parseJson(
      new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(bin, c => c.charCodeAt(0))
      ),
      LIMITS.share
    );
  } catch {
    throw Error("分享链接无法解析");
  }
}
export function createShare(lesson, legs) {
  const clean = normalizeLesson(portableLesson(lesson));
  const valid = validDraft(legs, clean);
  if (!valid.length || JSON.stringify(valid) !== JSON.stringify(legs))
    throw Error("仅可分享合法的非空组合");
  const encoded = encode({
    format: "arcade-combo",
    version: 1,
    lesson: portableLesson(clean),
    legs: valid,
  });
  if (encoded.length > LIMITS.share) throw Error("组合内容过大");
  return encoded;
}
export function readShare(s) {
  const raw = object(decode(s), ["format", "version", "lesson", "legs"]);
  if (raw.format !== "arcade-combo" || raw.version !== 1)
    throw Error("分享版本不支持");
  const lesson = normalizeLesson(raw.lesson),
    legs = validDraft(raw.legs, lesson);
  if (!legs.length || JSON.stringify(legs) !== JSON.stringify(raw.legs))
    throw Error("分享持仓不合法");
  return { lesson, legs };
}
export function importedProgress(payload, levels, current) {
  if (
    !plain(payload) ||
    ![1, 2, 3].includes(payload.version) ||
    payload.application !== "交易游乐场 · 期权积木" ||
    !plain(payload.progress)
  )
    throw Error("不是受支持的学习记录");
  const p = payload.progress,
    next = structuredClone(current),
    changes = [];
  for (const level of levels) {
    const record = p.completed?.[level.id],
      draft = p.drafts?.[level.id];
    if (
      record &&
      plain(record) &&
      Number.isInteger(record.stars) &&
      record.stars >= 1 &&
      record.stars <= 3
    ) {
      const ls = validDraft(record.legs, level),
        h = p.hintUse?.[level.id] ?? 0;
      if (!Number.isInteger(h) || h < 0 || h > 2) throw Error("提示记录无效");
      const certified = level.infeasible && !enumerate(level).feasible;
      if (!certified && (!ls.length || !checkLevel(level, ls).pass))
        throw Error(`完成记录未通过重新判题：${level.title}`);
      const stars = Math.min(record.stars, 3 - h);
      if (stars > (next.completed[level.id]?.stars || 0)) {
        next.completed[level.id] = {
          stars,
          legs: ls,
          completedAt: null,
          modelVersion: 2,
        };
        changes.push(level.title + "：合并较高星级");
      }
    }
    if (draft !== undefined) {
      const h = p.hintUse?.[level.id] ?? 0;
      if (!Number.isInteger(h) || h < 0 || h > 2)
        throw Error("草稿提示记录无效");
      const ls = validDraft(draft, level);
      if (!Array.isArray(draft) || JSON.stringify(ls) !== JSON.stringify(draft))
        throw Error(`草稿不合法：${level.title}`);
      if (!next.drafts[level.id]?.length && ls.length) {
        next.drafts[level.id] = ls;
        next.hintUse[level.id] = Math.max(
          next.hintUse[level.id] || 0,
          p.hintUse?.[level.id] || 0
        );
        changes.push(level.title + "：填入空草稿");
      }
    }
  }
  return { next, changes };
}
