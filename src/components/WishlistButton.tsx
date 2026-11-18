"use client";
import { useApp } from "./Providers";

/** Heart toggle. `overlay` floats on a product card; `inline` sits in a row (product page). */
export default function WishlistButton({ productId, variant = "overlay" }: { productId: number; variant?: "overlay" | "inline" }) {
  const { wishlist, toggleWish } = useApp();
  const on = wishlist.includes(productId);
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWish(productId); }}
      aria-pressed={on} aria-label={on ? "Remove from wishlist" : "Add to wishlist"}
      className={variant === "overlay"
        ? "absolute right-1.5 top-1.5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow transition hover:scale-110"
        : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white transition hover:border-red-300"}>
      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${on ? "fill-red-500 stroke-red-500" : "fill-none stroke-gray-600"}`} strokeWidth="2" strokeLinejoin="round" aria-hidden>
        <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 2.8 5 6.2 5c2 0 3.2 1 3.8 2 .6-1 1.8-2 3.8-2 3.4 0 5.3 3.3 3.8 6.7C19.5 16.4 12 21 12 21z" />
      </svg>
    </button>
  );
}
