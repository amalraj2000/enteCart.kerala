"use client";
import { useState } from "react";
import ReviewPhotos from "./ReviewPhotos";
import { Stars } from "./Stars";
import { formatIst } from "@/lib/istDate";
import type { PublicReview } from "@/lib/reviews";

export type ReviewsInitial = { enabled: boolean; avg: number; count: number; reviews: PublicReview[]; hasMore: boolean };

/** "Customer Reviews" on the product page: average + count, then approved reviews 2 at a time with a "Load more" button (no page reload). */
export default function ReviewsSection({ productId, initial }: { productId: number; initial: ReviewsInitial }) {
  const [list, setList] = useState(initial.reviews);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  if (!initial.enabled) return null; // reviews switched off by the owner

  async function more() {
    setBusy(true); setFailed(false);
    try {
      const r = await fetch(`/api/reviews?product=${productId}&offset=${list.length}`);
      const d = await r.json();
      if (!r.ok) throw new Error();
      const seen = new Set(list.map((x) => x.id));
      setList([...list, ...(d.reviews as PublicReview[]).filter((x) => !seen.has(x.id))]);
      setHasMore(!!d.hasMore);
    } catch { setFailed(true); }
    setBusy(false);
  }

  return (
    <section id="reviews" className="card mt-6 p-4 md:p-8" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="text-xl font-bold">Customer Reviews</h2>
      {initial.count === 0 ? (
        <p className="mt-3 text-gray-500">No reviews yet. Customers who have received this product can review it from their order.</p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <p className="text-4xl font-extrabold text-gray-900">{initial.avg.toFixed(1)}</p>
            <div>
              <Stars value={initial.avg} size="h-5 w-5" label={`Average rating ${initial.avg} out of 5`} />
              <p className="text-sm text-gray-500">{initial.count} review{initial.count === 1 ? "" : "s"}</p>
            </div>
          </div>
          <ul className="mt-4 divide-y">
            {list.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700" aria-hidden>{r.name[0]?.toUpperCase()}</span>
                  <span className="font-semibold">{r.name}</span>
                  <Stars value={r.rating} />
                  <span className="text-xs text-gray-400">{formatIst(r.created_at).split(",")[0]}</span>
                  <span className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">Verified purchase</span>
                </div>
                <p className="mt-2 whitespace-pre-line break-words text-gray-700">{r.comment}</p>
                <ReviewPhotos images={r.images} />
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="mt-2 text-center">
              <button type="button" className="btn-outline" onClick={more} disabled={busy}>{busy ? "Loading…" : "Load more"}</button>
              {failed && <p className="mt-2 text-sm text-red-600">Could not load more reviews. Please try again.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
