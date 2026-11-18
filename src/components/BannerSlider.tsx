"use client";
import Img from "./Img";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type BannerData = { id: number; title: string; subtitle: string; button_text: string; link: string; image: string };

/** Promotional banner carousel: auto-plays, pauses on hover, arrows/dots, swipe on touch. */
export default function BannerSlider({ banners }: { banners: BannerData[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = banners.length;

  useEffect(() => {
    if (n < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 5500);
    return () => clearInterval(t);
  }, [n, paused]);

  const go = (d: number) => setI((x) => (x + d + n) % n);
  return (
    <section aria-roledescription="carousel" aria-label="Promotions" className="relative mb-6 overflow-hidden rounded-2xl"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touchX.current !== null && n > 1) { const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); } touchX.current = null; }}>
      <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {banners.map((b, k) => {
          const external = /^https?:\/\//.test(b.link);
          return (
            <div key={b.id} className="relative h-48 w-full shrink-0 sm:h-64 md:h-80" aria-hidden={k !== i} aria-label={`${k + 1} of ${n}`} role="group">
              {b.image
                ? <Img src={b.image} alt="" sizes="100vw" priority={k === 0} className="absolute inset-0 h-full w-full object-cover" />
                : <div className="absolute inset-0 bg-gradient-to-r from-brand-700 to-brand-500" />}
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
              <div className="relative flex h-full max-w-xl flex-col justify-center gap-2 px-6 text-white sm:px-10">
                <h2 className="text-2xl font-extrabold leading-tight drop-shadow sm:text-4xl">{b.title}</h2>
                {b.subtitle && <p className="text-sm text-white/90 drop-shadow sm:text-lg">{b.subtitle}</p>}
                {b.button_text && b.link && (external
                  ? <a href={b.link} target="_blank" rel="noopener noreferrer" tabIndex={k === i ? 0 : -1} className="mt-2 inline-flex w-fit rounded-lg bg-white px-5 py-2 text-sm font-bold text-brand-700 shadow hover:bg-brand-50">{b.button_text}</a>
                  : <Link href={b.link} tabIndex={k === i ? 0 : -1} className="mt-2 inline-flex w-fit rounded-lg bg-white px-5 py-2 text-sm font-bold text-brand-700 shadow hover:bg-brand-50">{b.button_text}</Link>)}
              </div>
            </div>
          );
        })}
      </div>
      {n > 1 && (
        <>
          <button type="button" aria-label="Previous banner" onClick={() => go(-1)} className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 rounded-full bg-white/85 text-2xl shadow hover:bg-white sm:block">‹</button>
          <button type="button" aria-label="Next banner" onClick={() => go(1)} className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 rounded-full bg-white/85 text-2xl shadow hover:bg-white sm:block">›</button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
            {banners.map((b, k) => <button key={b.id} type="button" aria-label={`Banner ${k + 1}`} onClick={() => setI(k)} className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-white" : "w-2 bg-white/60"}`} />)}
          </div>
        </>
      )}
    </section>
  );
}
