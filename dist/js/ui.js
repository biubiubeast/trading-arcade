const paths = {
  blocks: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  book: "M12 5c-4-3-8-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-1-1-5-2-9 1z M12 5v15",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12 M6 18 18 6",
  help: "M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 18h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  trophy:
    "M8 3h8v7a4 4 0 0 1-8 0z M8 5H4v3a4 4 0 0 0 4 4 M16 5h4v3a4 4 0 0 1-4 4 M12 14v6 M8 21h8",
  map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16 M15 5v16",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  search: "M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  store: "M3 10h18 M4 10v11h16V10 M3 10l2-7h14l2 7 M9 21v-7h6v7",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
  bulb: "M9 18h6 M9 21h6 M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2",
  reset: "M3 10a9 9 0 1 1 2 8 M3 3v7h7",
  plus: "M12 5v14 M5 12h14",
  minus: "M5 12h14",
  trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  download: "M12 3v12 m-5-5 5 5 5-5 M4 17v4h16v-4",
  clock: "M12 6v6l4 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  target: "M21 12a9 9 0 1 1-9-9 M17 12a5 5 0 1 1-5-5 M12 12l9-9 M16 3h5v5",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6",
  info: "M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  external: "M14 3h7v7 M21 3 10 14 M10 3H3v18h18v-7",
  flag: "M5 21V3 M5 3c5-4 9 4 15 0v10c-6 4-10-4-15 0",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z",
};
export const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.blocks}"/></svg>`;
export const money = n =>
  !Number.isFinite(n)
    ? "无限"
    : (n < -0.0001 ? "−" : "") + "$" + Math.abs(n).toFixed(2);
export const signed = n => (n > 0 ? "+" : "") + money(n);
export const typeName = t =>
  ({ call: "看涨期权", put: "看跌期权", stock: "现货", cash: "现金" })[t];
export const legName = l =>
  ({ call: "Call", put: "Put", stock: "现货", cash: "现金" })[l.type] +
  (["call", "put"].includes(l.type) ? ` · K${l.strike}` : "");
