/* eslint-disable @next/next/no-img-element */
// Plain <img> so admins can paste ANY image URL (Meesho, etc.) without configuring next/image domains.
// Our own uploads and Unsplash links get a responsive srcSet (small phones download small WebP files).
import { responsiveSrc } from "@/lib/imgSrc";

/**
 * `sizes` = how wide the picture is shown (e.g. "96px", "(max-width:768px) 50vw, 300px") so the browser picks the smallest file that looks sharp.
 * `priority` = above-the-fold picture (load now, not lazily).
 */
export default function Img({ src, alt, className, sizes = "320px", priority = false }: { src: string; alt: string; className?: string; sizes?: string; priority?: boolean }) {
  if (!src) return <div className={`flex items-center justify-center bg-gray-100 text-4xl ${className}`}>🛍️</div>;
  const r = responsiveSrc(src);
  return (
    <img src={r.src} srcSet={r.srcSet} sizes={r.srcSet ? sizes : undefined} alt={alt} className={className} referrerPolicy="no-referrer"
      loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" />
  );
}
