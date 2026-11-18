"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const W = 288; // popover width (px)

/** Small ⓘ button with a popover. The popover is positioned against the viewport, so it is never clipped by the page edge or hidden under the sticky header. */
export default function InfoTip({ title, lines, className = "" }: { title: string; lines: string[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLSpanElement>(null);

  const place = useCallback(() => {
    const b = btn.current?.getBoundingClientRect();
    if (!b) return;
    const width = Math.min(W, window.innerWidth - 16);
    const left = Math.max(8, Math.min(b.left + b.width / 2 - width / 2, window.innerWidth - width - 8)); // centred on the button, kept on screen
    const below = window.innerHeight - b.bottom, above = b.top - 70; // 70px ≈ sticky header
    // open downward when there's room (or more room than above), otherwise upward
    setPos(below >= 190 || below >= above ? { left, top: b.bottom + 8, width } : { left, bottom: window.innerHeight - b.top + 8, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, place]);

  return (
    <span ref={wrap} className={`inline-flex ${className}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button ref={btn} type="button" aria-label={title} aria-expanded={open} onClick={() => setOpen((o) => !o)} onFocus={() => setOpen(true)}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-brand-600 bg-white text-sm font-bold italic text-brand-700 hover:bg-brand-50">i</button>
      {open && pos && (
        <span role="tooltip" style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}
          className="z-[70] rounded-xl bg-gray-900 p-3 text-left text-xs font-normal not-italic leading-relaxed text-white shadow-xl">
          <b className="mb-1 block text-sm">{title}</b>
          <ul className="space-y-1">{lines.map((l) => <li key={l} className="flex gap-2"><span aria-hidden>•</span><span>{l}</span></li>)}</ul>
        </span>
      )}
    </span>
  );
}
