import { pnl, analyze } from "../engine.js";
export function comparisonPlot(a, b, market) {
  const lo = market.spot * 0.6,
    hi = market.spot * 1.4,
    points = Array.from({ length: 161 }, (_, i) => lo + ((hi - lo) * i) / 160),
    vals = [
      ...points.map(s => pnl(a, s, 0, undefined, market)),
      ...points.map(s => pnl(b, s, 0, undefined, market)),
      0,
    ],
    min = Math.min(...vals) - 3,
    max = Math.max(...vals) + 3,
    x = s => 40 + ((s - lo) / (hi - lo)) * 600,
    y = v => 20 + ((max - v) / (max - min)) * 150,
    path = ls =>
      points
        .map(
          (s, i) =>
            `${i ? "L" : "M"}${x(s)},${y(pnl(ls, s, 0, undefined, market))}`
        )
        .join(" ");
  return `<div class="comparison-chart"><svg viewBox="0 0 680 205" role="img" aria-label="对照与当前组合的到期净损益叠加曲线"><line x1="40" x2="640" y1="${y(0)}" y2="${y(0)}" stroke="#cdd7c3" stroke-dasharray="3 5"/><path d="${path(a)}" fill="none" stroke="#a489b8" stroke-width="2.3" stroke-dasharray="5 4"/><path d="${path(b)}" fill="none" stroke="#5b8057" stroke-width="2.5"/>${[lo, market.spot, hi].map(s => `<text x="${x(s)}" y="195" font-size="11" fill="#7b896d" text-anchor="middle">$${s.toFixed(0)}</text>`).join("")}</svg><div class="chart-legend"><span><i class="line" style="border-color:#a489b8;border-top-style:dashed"></i>已保存对照</span><span><i class="line"></i>当前组合</span><span>纵轴：到期净损益</span></div></div>`;
}
