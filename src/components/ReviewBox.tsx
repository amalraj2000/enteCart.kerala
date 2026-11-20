"use client";
import { useState } from "react";
import ReviewForm from "./ReviewForm";
import ReviewPhotos from "./ReviewPhotos";
import { Stars } from "./Stars";
import { toast } from "./Toaster";
import { formatIst } from "@/lib/istDate";
import type { MyReview } from "@/lib/reviews";

const STATUS: Record<string, [string, string]> = {
  pending: ["Awaiting approval", "bg-amber-100 text-amber-800"],
  approved: ["Published", "bg-green-100 text-green-800"],
  rejected: ["Not approved", "bg-red-100 text-red-700"],
};
const HIDDEN: [string, string] = ["Hidden by the shop", "bg-gray-200 text-gray-700"];

/**
 * Shown under a product on the customer's DELIVERED order: an "Add Review" button, or — once reviewed — the customer's own review
 * with Edit and Delete. `enabled` is the shop's master switch (Admin → Reviews).
 */
export default function ReviewBox({ productId, title, review, enabled, canReview, onChanged }: { productId: number; title: string; review: MyReview | null; enabled: boolean; canReview: boolean; onChanged: () => void }) {
  const [mode, setMode] = useState<"view" | "form">("view");
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!review || !confirm("Delete your review? This can't be undone.")) return;
    setBusy(true);
    const r = await fetch(`/api/reviews/${review.id}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || "Could not delete");
    toast.success("Review deleted"); onChanged();
  }

  if (mode === "form") return <ReviewForm productId={productId} initial={review ? { id: review.id, rating: review.rating, comment: review.comment, images: review.images } : undefined} onDone={() => { setMode("view"); onChanged(); }} onCancel={() => setMode("view")} />;

  if (!review) {
    if (!enabled || !canReview) return null; // reviews are off, or the order isn't delivered
    return <button type="button" className="btn-outline mt-3" onClick={() => setMode("form")} aria-label={`Add review for ${title}`}>★ Add Review</button>;
  }
  const locked = review.status === "approved"; // approved reviews are final: no Edit / Delete
  const [label, tone] = locked && !review.active ? HIDDEN : STATUS[review.status] ?? STATUS.pending;
  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stars value={review.rating} />
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
        <span className="text-xs text-gray-400">{formatIst(review.created_at)}</span>
      </div>
      <p className="mt-2 whitespace-pre-line break-words text-sm text-gray-800">{review.comment}</p>
      <ReviewPhotos images={review.images} />
      {review.status === "pending" && <p className="mt-2 text-xs text-gray-500">Your review is waiting for approval. Others will see it once it is approved.</p>}
      {review.status === "rejected" && <p className="mt-2 text-xs text-red-600">This review was not approved, so it isn’t shown to others. You can edit it and send it again.</p>}
      {locked ? (
        <p className="mt-2 text-xs text-gray-500">{review.active ? "Your review is published." : "Your review has been approved, but the shop is not showing it right now."} Approved reviews can’t be edited or deleted. Please contact us if something is wrong.</p>
      ) : (
        <div className="mt-3 flex gap-2">
          {enabled && <button type="button" className="btn-outline !px-3 !py-1.5" onClick={() => setMode("form")} disabled={busy}>Edit</button>}
          <button type="button" className="btn-danger !px-3 !py-1.5" onClick={remove} disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>
        </div>
      )}
    </div>
  );
}
