"use client";
import { useEffect, useRef, useState } from "react";

/** Small ⓘ button that shows a short note in a popover (click, hover or keyboard). */
export default function InfoTip({ title, lines, className = "" }: { title: string; lines: string[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <span ref={ref} className={`relative inline-flex ${className}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={title} aria-expanded={open} onClick={() => setOpen((o) => !o)} onFocus={() => setOpen(true)}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-brand-600 bg-white text-sm font-bold italic text-brand-700 hover:bg-brand-50">i</button>
      {open && (
        <span role="tooltip" className="absolute bottom-full right-0 z-30 mb-2 w-72 max-w-[80vw] rounded-xl bg-gray-900 p-3 text-left text-xs font-normal not-italic leading-relaxed text-white shadow-xl">
          <b className="mb-1 block text-sm">{title}</b>
          <ul className="space-y-1">{lines.map((l) => <li key={l} className="flex gap-2"><span aria-hidden>•</span><span>{l}</span></li>)}</ul>
        </span>
      )}
    </span>
  );
}
