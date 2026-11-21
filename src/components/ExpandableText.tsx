"use client";
import { useEffect, useRef, useState } from "react";

/** Shows the first few lines of a long text with a "Show more / Show less" button (only when it is actually cut off). The full text is always in the page, so search engines still read it. */
export default function ExpandableText({ text, lines = 4, className = "" }: { text: string; lines?: number; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  useEffect(() => {
    const check = () => { const el = ref.current; if (el && !open) setCut(el.scrollHeight - el.clientHeight > 1); };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text, open]);
  return (
    <div>
      <p ref={ref} className={`whitespace-pre-line break-words ${className}`} style={open ? undefined : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines, overflow: "hidden" }}>{text}</p>
      {(cut || open) && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-1 text-sm font-semibold text-brand-700 hover:underline">{open ? "Show less" : "Show more"}</button>
      )}
    </div>
  );
}
