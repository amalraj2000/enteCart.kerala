"use client";
import { useRef, useState } from "react";
import { largeSrc } from "@/lib/imgSrc";
import Img from "./Img";

/**
 * Flipkart-style product gallery: vertical thumbnail strip on the left (below the image on mobile),
 * big image with hover-zoom, arrows, counter, and swipe on touch screens.
 */
export default function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const touchX = useRef<number | null>(null);
  const n = images.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col-reverse gap-3 md:flex-row">
      {n > 1 && (
        <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto md:max-h-[34rem] md:flex-col md:overflow-y-auto md:overflow-x-visible md:pr-1">
          {images.map((src, k) => (
            <button key={k} type="button" aria-label={`Photo ${k + 1}`} aria-current={k === i}
              onClick={() => setI(k)} onMouseEnter={() => setI(k)} onFocus={() => setI(k)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white md:h-[4.5rem] md:w-[4.5rem] ${k === i ? "border-brand-600" : "border-gray-200 opacity-80 hover:opacity-100"}`}>
              <Img src={src} alt="" sizes="72px" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="relative min-w-0 flex-1">
        <div
          className="relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl border bg-white"
          onMouseMove={onMove} onMouseLeave={() => setZoom(null)}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current === null || n < 2) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); // swipe
            touchX.current = null;
          }}>
          <Img src={images[i] || ""} alt={alt} priority sizes="(max-width: 768px) 100vw, 560px"
            className="h-full w-full object-contain transition-transform duration-150 ease-out"
          />
          {zoom && images[i] && (
            // magnified copy follows the cursor
            <div className="pointer-events-none absolute inset-0 hidden bg-white md:block" style={{ backgroundImage: `url("${largeSrc(images[i])}")`, backgroundSize: "250%", backgroundPosition: `${zoom.x}% ${zoom.y}%`, backgroundRepeat: "no-repeat" }} />
          )}
          {n > 1 && (
            <>
              <button type="button" aria-label="Previous photo" onClick={() => go(-1)} className="absolute left-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-white/90 text-2xl shadow hover:bg-white">‹</button>
              <button type="button" aria-label="Next photo" onClick={() => go(1)} className="absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-white/90 text-2xl shadow hover:bg-white">›</button>
              <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{i + 1} / {n}</span>
            </>
          )}
        </div>
        {n > 1 && (
          <div className="mt-2 flex justify-center gap-1.5 md:hidden">
            {images.map((_, k) => <span key={k} className={`h-1.5 rounded-full ${k === i ? "w-4 bg-brand-600" : "w-1.5 bg-gray-300"}`} />)}
          </div>
        )}
      </div>
    </div>
  );
}
