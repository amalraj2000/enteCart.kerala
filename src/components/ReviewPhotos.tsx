"use client";
import { useEffect, useState } from "react";

/** Row of small review photos; clicking one opens it full size (Esc / click outside to close, arrow keys to move between photos). */
export default function ReviewPhotos({ images, size = "h-16 w-16" }: { images: string[]; size?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % images.length));
      else if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + images.length) % images.length));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, images.length]);
  if (!images.length) return null;
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {images.map((u, i) => (
          <button key={u} type="button" onClick={() => setOpen(i)} aria-label={`Open review photo ${i + 1}`}
            className={`${size} overflow-hidden rounded-lg border border-gray-200 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Review photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div role="dialog" aria-modal="true" aria-label="Review photo" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[open]} alt={`Review photo ${open + 1} of ${images.length}`} className="max-h-[90vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          <button type="button" aria-label="Close" onClick={() => setOpen(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl text-gray-800">✕</button>
          {images.length > 1 && (<>
            <button type="button" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + images.length) % images.length); }} className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl">‹</button>
            <button type="button" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % images.length); }} className="absolute right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl">›</button>
          </>)}
        </div>
      )}
    </>
  );
}
