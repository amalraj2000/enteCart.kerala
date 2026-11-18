"use client";
import { useEffect, useState } from "react";
import Img from "./Img";

/** Home-page product photo: cross-fading slideshow when a product has several photos (pauses on hover). */
export default function CardSlideshow({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = images.length;

  useEffect(() => {
    if (n < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 2600 + (alt.length % 5) * 250); // slight offset so cards don't flip in sync
    return () => clearInterval(t);
  }, [n, paused, alt]);

  if (n === 0) return <Img src="" alt={alt} className="aspect-square w-full" />;
  return (
    <div className="relative aspect-square w-full overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {images.map((src, k) => (
        <Img key={src + k} src={src} alt={k === i ? alt : ""} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${k === i ? "opacity-100" : "opacity-0"}`} />
      ))}
      {n > 1 && (
        <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {images.map((_, k) => <span key={k} className={`h-1.5 rounded-full bg-white shadow transition-all ${k === i ? "w-4 opacity-100" : "w-1.5 opacity-60"}`} />)}
        </div>
      )}
    </div>
  );
}
