import { normalizePack, portablePack } from "./content.js";
export const LIBRARY_KEY = "trade-arcade:courses:v1";
export function fingerprint(pack) {
  let h = 2166136261;
  for (const c of JSON.stringify(
    portablePack(normalizePack(portablePack(pack)))
  ))
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16);
}
export function addCourse(items, raw) {
  const pack = normalizePack(portablePack(raw)),
    hash = fingerprint(pack);
  const existing = items.find(x => x.hash === hash && x.pack.id === pack.id);
  if (existing) return { items, entry: existing, change: "same" };
  if (items.length >= 12)
    throw Error("课程收藏已达 12 个版本；请先导出并移除不用的版本。");
  const revision =
    items
      .filter(x => x.pack.id === pack.id)
      .reduce((n, x) => Math.max(n, x.revision), 0) + 1;
  const entry = {
    key: pack.id + ":" + hash,
    hash,
    revision,
    pack: portablePack(pack),
  };
  return {
    items: [...items, entry],
    entry,
    change: revision > 1 ? "revision" : "new",
  };
}
export function readLibrary(storage, active) {
  let items = [],
    initialized = false;
  try {
    const raw = JSON.parse(storage.getItem(LIBRARY_KEY));
    if (raw?.version === 1 && Array.isArray(raw.items)) {
      initialized = true;
      for (const x of raw.items.slice(0, 12)) {
        try {
          const added = addCourse(items, x.pack);
          items = added.items;
          if (
            Number.isInteger(x.revision) &&
            x.revision >= added.entry.revision &&
            x.revision <= 10000
          )
            added.entry.revision = x.revision;
        } catch {}
      }
    }
  } catch {}
  if (active && !initialized)
    try {
      items = addCourse(items, active).items;
    } catch {}
  return items;
}
export function writeLibrary(storage, items) {
  storage.setItem(LIBRARY_KEY, JSON.stringify({ version: 1, items }));
}
