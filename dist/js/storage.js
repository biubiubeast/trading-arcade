export const KEY = "trade-arcade:payoff:v2";
export const LEGACY_KEY = "trade-arcade:v1";
const empty = () => ({
  version: 2,
  completed: {},
  drafts: {},
  hintUse: {},
  predictions: {},
  sessions: {},
  comparisons: {},
  lastLevel: 0,
  lastTransfer: 0,
  lastMode: "challenge",
  customCourse: null,
  lastCourse: 0,
});
export function readProgress(storage) {
  try {
    const db = storage || globalThis.localStorage;
    const current = db.getItem(KEY),
      p = JSON.parse(current ?? db.getItem(LEGACY_KEY));
    if (!p || ![1, 2].includes(p.version)) return empty();
    const completed = {},
      hintUse = {},
      predictions = {};
    for (const [id, item] of Object.entries(p.completed || {}))
      if (
        item &&
        Number.isInteger(item.stars) &&
        item.stars >= 1 &&
        item.stars <= 3
      )
        completed[id] = {
          stars: item.stars,
          completedAt:
            typeof item.completedAt === "string"
              ? item.completedAt.slice(0, 30)
              : null,
          legs: Array.isArray(item.legs) ? item.legs : [],
          modelVersion: item.modelVersion === 2 ? 2 : 1,
        };
    for (const [id, n] of Object.entries(p.hintUse || {}))
      if (Number.isInteger(n) && n >= 0 && n <= 2) hintUse[id] = n;
    for (const [id, a] of Object.entries(p.predictions || {}))
      if (a && Number.isInteger(a.choice) && a.choice >= 0 && a.choice < 3)
        predictions[id] = { choice: a.choice };
    return {
      ...empty(),
      customCourse:
        p.customCourse && typeof p.customCourse === "object"
          ? p.customCourse
          : null,
      lastCourse:
        Number.isInteger(p.lastCourse) && p.lastCourse >= 0 && p.lastCourse < 12
          ? p.lastCourse
          : 0,
      completed,
      hintUse,
      predictions,
      drafts: p.drafts && typeof p.drafts === "object" ? p.drafts : {},
      sessions: p.sessions && typeof p.sessions === "object" ? p.sessions : {},
      comparisons:
        p.comparisons && typeof p.comparisons === "object" ? p.comparisons : {},
      lastLevel:
        Number.isInteger(p.lastLevel) && p.lastLevel >= 0 && p.lastLevel < 6
          ? p.lastLevel
          : 0,
      lastTransfer:
        Number.isInteger(p.lastTransfer) &&
        p.lastTransfer >= 0 &&
        p.lastTransfer < 3
          ? p.lastTransfer
          : 0,
      lastMode: ["challenge", "transfer", "sandbox", "course"].includes(
        p.lastMode
      )
        ? p.lastMode
        : "challenge",
    };
  } catch {
    return empty();
  }
}
export function saveProgress(p, storage) {
  try {
    (storage || globalThis.localStorage).setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
export function validDraft(raw, level) {
  if (!Array.isArray(raw) || raw.length > 8) return [];
  const valid = raw.every(
    l =>
      l &&
      level.types.includes(l.type) &&
      Number.isInteger(l.qty) &&
      l.qty !== 0 &&
      Math.abs(l.qty) <= 8 &&
      (level.sell || l.qty > 0) &&
      (["call", "put"].includes(l.type)
        ? level.strikes.includes(l.strike)
        : l.strike === 0)
  );
  const ids = raw.map(l => l.type + ":" + l.strike);
  return valid &&
    new Set(ids).size === ids.length &&
    raw.reduce((s, l) => s + Math.abs(l.qty), 0) <= level.maxUnits
    ? raw.map(l => ({ type: l.type, strike: l.strike, qty: l.qty }))
    : [];
}
