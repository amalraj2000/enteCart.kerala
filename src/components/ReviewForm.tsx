"use client";
import { useRef, useState } from "react";
import { StarInput } from "./Stars";
import { toast } from "./Toaster";
import FieldError from "./FieldError";
import { toPhoto } from "@/lib/image";
import { REVIEW_COMMENT_MAX, REVIEW_MAX_PHOTOS, cleanReview, firstError, validateReview, type Errors } from "@/lib/validate";

export type ReviewDraft = { id?: number; rating: number; comment: string; images: string[] };

/** Write or edit a review: stars (required), comment (required), photos (optional). */
export default function ReviewForm({ productId, initial, onDone, onCancel }: { productId: number; initial?: ReviewDraft; onDone: () => void; onCancel: () => void }) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!files.length) return;
    const room = REVIEW_MAX_PHOTOS - images.length;
    if (room <= 0) return toast.error(`You can add up to ${REVIEW_MAX_PHOTOS} photos`);
    if (files.length > room) toast.error(`Only ${room} more photo${room > 1 ? "s" : ""} can be added`);
    setUploading(true);
    const added: string[] = [];
    for (const f of files.slice(0, room)) {
      try {
        const data = await toPhoto(f);
        const r = await fetch("/api/reviews/photos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Upload failed");
        added.push(d.url);
      } catch (err) { toast.error((err as Error).message); }
    }
    setImages((x) => [...x, ...added]);
    setUploading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = cleanReview({ rating, comment, images });
    const ve = validateReview(body); setErrs(ve);
    if (firstError(ve)) return;
    setBusy(true);
    const r = await fetch(initial?.id ? `/api/reviews/${initial.id}` : "/api/reviews", {
      method: initial?.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initial?.id ? body : { ...body, productId }),
    });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return toast.error(d.error || "Could not save your review");
    toast.success(initial?.id ? "Review updated. It will show again once approved." : "Thank you! Your review will appear once it is approved.");
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div>
        <p className="mb-1 text-sm font-medium">Your rating <span className="text-red-500">*</span></p>
        <StarInput value={rating} onChange={(n) => { setRating(n); setErrs((e) => ({ ...e, rating: "" })); }} />
        <FieldError msg={errs.rating} />
      </div>
      <label className="block text-sm font-medium">Your review <span className="text-red-500">*</span>
        <textarea className={`input mt-1 ${errs.comment ? "!border-red-500" : ""}`} rows={4} maxLength={REVIEW_COMMENT_MAX} value={comment} onChange={(e) => { setComment(e.target.value); setErrs((x) => ({ ...x, comment: "" })); }} placeholder="How was the product? Quality, fit, delivery…" />
        <span className="mt-1 flex justify-between text-xs font-normal text-gray-400"><span>{errs.comment ? "" : "Be honest and helpful"}</span><span>{comment.length}/{REVIEW_COMMENT_MAX}</span></span>
        <FieldError msg={errs.comment} />
      </label>
      <div>
        <p className="mb-1 text-sm font-medium">Photos <span className="font-normal text-gray-400">(optional, up to {REVIEW_MAX_PHOTOS})</span></p>
        <div className="flex flex-wrap items-center gap-2">
          {images.map((u) => (
            <div key={u} className="relative h-16 w-16">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="Review photo" className="h-full w-full rounded-lg border object-cover" />
              <button type="button" aria-label="Remove photo" onClick={() => setImages(images.filter((x) => x !== u))} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white">✕</button>
            </div>
          ))}
          {images.length < REVIEW_MAX_PHOTOS && (
            <button type="button" disabled={uploading} onClick={() => file.current?.click()} className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 hover:border-brand-600 hover:text-brand-700 disabled:opacity-50">
              <span className="text-xl leading-none">{uploading ? "…" : "+"}</span>{uploading ? "Adding" : "Photo"}
            </button>
          )}
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={pick} />
        </div>
        <FieldError msg={errs.images} />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy || uploading}>{busy ? "Saving…" : initial?.id ? "Save changes" : "Submit review"}</button>
        <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
