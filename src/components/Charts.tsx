"use client";
import { useRef, useState } from "react";

/* ---------- helpers ---------- */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v)), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
};
const compact = (n: number) => (n >= 1e7 ? `${+(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${+(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : String(n));

/** Value formats are named (not passed as functions) so server pages can hand them to these client components. */
export type Fmt = { money?: boolean; singular?: string; plural?: string; suffix?: string };
const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN");
const fmt = (n: number, f: Fmt) => (f.money ? inr(n) : f.singular ? `${n} ${n === 1 ? f.singular : f.plural ?? f.singular + "s"}` : `${n}${f.suffix ?? ""}`);

/* ---------- time series (line + 10% area, crosshair tooltip, table view) ---------- */
export type Point = { date: string; value: number };

export function TimeSeries({ data, fmt: f, name, color = "var(--series-1)" }: { data: Point[]; fmt: Fmt; name: string; color?: string }) {
  const format = (n: number) => fmt(n, f);
  const W = 460, H = 220, m = { l: 40, r: 12, t: 12, b: 26 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const n = data.length;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const x = (i: number) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => m.t + ih - (v / max) * ih;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const ticks = [0, 1, 2, 3, 4].map((k) => (max / 4) * k);
  const xl = Array.from(new Set([0, Math.round((n - 1) * 0.5), n - 1])).filter((i) => i >= 0 && i < n);
  const total = data.reduce((s, d) => s + d.value, 0);

  function move(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1)))));
  }
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y select-none" role="img" aria-label={`${name} chart`}
        onPointerMove={move} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth="1" />
            <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)">{compact(Math.round(t * 100) / 100)}</text>
          </g>
        ))}
        {xl.map((i) => <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="12" fill="var(--text-muted)">{fmtDate(data[i].date)}</text>)}
        <path d={area} fill={color} opacity="0.1" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {n > 0 && hover === null && <circle cx={x(n - 1)} cy={y(data[n - 1].value)} r="4" fill={color} stroke="var(--surface-1)" strokeWidth="2" />}
        {h && (
          <g pointerEvents="none">
            <line x1={x(hover!)} x2={x(hover!)} y1={m.t} y2={y(0)} stroke="var(--axis)" strokeWidth="1" />
            <circle cx={x(hover!)} cy={y(h.value)} r="5" fill={color} stroke="var(--surface-1)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-1 z-10 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: `${Math.min(80, Math.max(20, (x(hover!) / W) * 100))}%`, transform: "translateX(-50%)" }}>
          <p className="text-gray-300">{fmtDate(h.date)}</p>
          <p className="font-semibold">{format(h.value)}</p>
        </div>
      )}
      {total === 0 && <p className="absolute inset-x-0 top-1/3 text-center text-sm text-gray-400">No data in this period</p>}
      <details className="mt-2 text-xs text-gray-500">
        <summary className="cursor-pointer select-none hover:text-gray-800">View as table</summary>
        <div className="mt-2 max-h-48 overflow-auto rounded border">
          <table className="w-full text-left"><thead className="sticky top-0 bg-gray-50"><tr><th className="p-2">Date</th><th className="p-2 text-right">{name}</th></tr></thead>
            <tbody>{data.map((d) => <tr key={d.date} className="border-t"><td className="p-2">{fmtDate(d.date)}</td><td className="p-2 text-right">{format(d.value)}</td></tr>)}</tbody></table>
        </div>
      </details>
    </div>
  );
}

/* ---------- donut (part-to-whole) with legend that carries names, counts and shares ---------- */
export type Slice = { label: string; value: number; color: string };

export function Donut({ slices, centerLabel }: { slices: Slice[]; centerLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((s, d) => s + d.value, 0);
  const cx = 100, cy = 100, R = 88, r = 58, gap = 2 / R; // 2px surface gap between slices
  const pt = (rad: number, a: number) => [cx + rad * Math.sin(a), cy - rad * Math.cos(a)];
  let acc = 0;
  const arcs = slices.map((s, i) => {
    if (!s.value) return null;
    const a0 = (acc / total) * 2 * Math.PI; acc += s.value; const a1 = (acc / total) * 2 * Math.PI;
    if (s.value === total) return { i, full: true as const };
    const g = Math.min(gap, (a1 - a0) / 3), big = a1 - a0 - 2 * g > Math.PI ? 1 : 0;
    const [x0, y0] = pt(R, a0 + g), [x1, y1] = pt(R, a1 - g), [x2, y2] = pt(r, a1 - g), [x3, y3] = pt(r, a0 + g);
    return { i, full: false as const, d: `M${x0},${y0} A${R},${R} 0 ${big} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${big} 0 ${x3},${y3} Z` };
  });
  const hv = hover !== null ? slices[hover] : null;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0" role="img" aria-label={`${centerLabel} breakdown`}>
        {total === 0 && <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke="var(--grid)" strokeWidth={R - r} />}
        {arcs.map((a) => a && (a.full
          ? <circle key={a.i} cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke={slices[a.i].color} strokeWidth={R - r} onPointerEnter={() => setHover(a.i)} onPointerLeave={() => setHover(null)} />
          : <path key={a.i} d={a.d} fill={slices[a.i].color} opacity={hover === null || hover === a.i ? 1 : 0.45} onPointerEnter={() => setHover(a.i)} onPointerLeave={() => setHover(null)} />))}
        <text x={cx} y={hv ? cy - 4 : cy + 2} textAnchor="middle" fontSize={hv ? 24 : 28} fontWeight="700" fill="var(--text-primary)">{hv ? hv.value : total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">{hv ? hv.label : centerLabel}</text>
      </svg>
      <ul className="min-w-40 flex-1 space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
            className={`flex items-center gap-2 rounded px-1.5 py-0.5 ${hover === i ? "bg-gray-100" : ""}`}>
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className="flex-1 text-gray-700">{s.label}</span>
            <span className="font-semibold">{s.value}</span>
            <span className="w-10 text-right text-xs text-gray-500">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- ranked horizontal bars (one hue), value at the tip ---------- */
export type Bar = { label: string; value: number; sub?: string };

export function BarList({ bars, fmt: f = {}, empty = "Nothing to show yet" }: { bars: Bar[]; fmt?: Fmt; empty?: string }) {
  const format = (n: number) => fmt(n, f);
  const max = Math.max(1, ...bars.map((b) => b.value));
  if (!bars.length) return <p className="py-6 text-center text-sm text-gray-400">{empty}</p>;
  return (
    <ul className="space-y-3">
      {bars.map((b) => (
        <li key={b.label} title={`${b.label}: ${format(b.value)}${b.sub ? ` · ${b.sub}` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-gray-800">{b.label}</span>
            <span className="shrink-0 font-semibold">{format(b.value)}</span>
          </div>
          <div className="h-2.5 w-full rounded-r-[4px] bg-gray-100">
            <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(2, (b.value / max) * 100)}%`, background: "var(--series-1)" }} />
          </div>
          {b.sub && <p className="mt-0.5 text-xs text-gray-400">{b.sub}</p>}
        </li>
      ))}
    </ul>
  );
}
