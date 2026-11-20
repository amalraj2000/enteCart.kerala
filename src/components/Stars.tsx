"use client";
import { useState } from "react";

const PATH = "M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6L2.5 9.5l6.6-.9L12 2.5z";

/** One star filled `fill` (0..1) from the left, using an SVG gradient (the same id always means the same gradient, so repeats are harmless). */
const Star = ({ fill, className }: { fill: number; className: string }) => {
  const pct = Math.round(Math.max(0, Math.min(1, fill)) * 100), id = `star-${pct}`;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs><linearGradient id={id}><stop offset={`${pct}%`} stopColor="#fbbf24" /><stop offset={`${pct}%`} stopColor="#e5e7eb" /></linearGradient></defs>
      <path d={PATH} fill={`url(#${id})`} />
    </svg>
  );
};

/** Read-only stars. Supports fractions (4.3 shows 4 full stars + a partly filled one). */
export function Stars({ value, size = "h-4 w-4", label }: { value: number; size?: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} fill={value - (n - 1)} className={size} />)}
    </span>
  );
}

/** Clickable 1–5 star input (keyboard friendly: it is a radio group). */
export function StarInput({ value, onChange, size = "h-8 w-8" }: { value: number; onChange: (n: number) => void; size?: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label="Star rating" className="inline-flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)} onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onBlur={() => setHover(0)}
          className="rounded p-0.5 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
          <svg viewBox="0 0 24 24" className={`${size} ${n <= shown ? "fill-amber-400" : "fill-gray-200"}`} aria-hidden><path d={PATH} /></svg>
        </button>
      ))}
    </div>
  );
}
