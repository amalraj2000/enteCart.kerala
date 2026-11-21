"use client";
import IconBtn from "@/components/IconBtn";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Img from "@/components/Img";
import Pagination from "@/components/Pagination";
import ReviewPhotos from "@/components/ReviewPhotos";
import FieldError from "@/components/FieldError";
import { StarInput, Stars } from "@/components/Stars";
import { toast } from "@/components/Toaster";
import { formatIst } from "@/lib/istDate";
import { REVIEW_COMMENT_MAX, cleanReview, firstError, validateReview, type Errors } from "@/lib/validate";
import type { PageInfo } from "@/lib/paginate";

export type AdminReview = { id: number; rating: number; comment: string; status: string; active: boolean; created_at: string; product_title: string; product_image: string; user_name: string; email: string; phone: string; images: string[] };
const BADGE: Record<string, string> = { pending: "bg-amber-100 text-amber-800", approved: "bg-green-100 text-green-800", rejected: "bg-red-100 text-red-700" };
type Modal = { kind: "view" | "edit"; id: number } | null;

export default function ReviewsManager({ reviews, pi, filter, filters, counts, enabled, isOwner }: { reviews: AdminReview[]; pi: PageInfo; filter: string; filters: string[]; counts: Record<string, number>; enabled: boolean; isOwner: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState<number | "toggle" | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const current = modal ? reviews.find((r) => r.id === modal.id) : null; // re-read from fresh server data after every change

  async function toggle() {
    const next = !on;
    if (!next && !confirm("Turn OFF reviews? The review section disappears from product pages and customers can no longer add or edit reviews. Existing reviews are kept.")) return;
    setBusy("toggle");
    const r = await fetch("/api/admin/reviews/toggle", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: next }) });
    setBusy(null);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return toast.error(d.error || "Could not change the setting");
    setOn(next); toast.success(next ? "Reviews are ON" : "Reviews are OFF"); router.refresh();
  }
  async function patch(id: number, body: { status?: string; active?: boolean }, msg: string) {
    setBusy(id);
    const r = await fetch(`/api/admin/reviews/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || "Could not update");
    toast.success(msg); router.refresh();
  }
  async function remove(id: number) {
    if (!confirm("Delete this review and its photos permanently?")) return;
    setBusy(id);
    const r = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || "Could not delete");
    setModal(null); toast.success("Review deleted"); router.refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Product reviews</h1>

      {isOwner && (
        <div className="card flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="font-semibold">Enable reviews</p>
            <p className="text-sm text-gray-500">{on ? "Customers can review delivered products, and approved reviews show on product pages." : "Off — the Add Review option and the review section are hidden. Existing reviews are kept."}</p>
          </div>
          <button type="button" role="switch" aria-checked={on} aria-label="Enable reviews" disabled={busy === "toggle"} onClick={toggle}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-brand-600" : "bg-gray-300"} ${busy === "toggle" ? "opacity-60" : ""}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
      )}
      {!isOwner && !on && <p className="card bg-amber-50 p-3 text-sm text-amber-800">The owner has switched reviews off for the shop right now.</p>}

      <nav className="flex flex-wrap gap-2" aria-label="Filter reviews">
        {filters.map((f) => (
          <Link key={f} href={f === "All" ? "/admin/reviews" : `/admin/reviews?f=${f}`} className={`rounded-full border px-3 py-1 text-sm font-medium ${f === filter ? "border-brand-600 bg-brand-600 text-white" : "bg-white hover:bg-brand-50"}`}>{f} <span className="opacity-70">({counts[f] ?? 0})</span></Link>
        ))}
      </nav>

      {reviews.length === 0 ? <p className="card p-8 text-center text-gray-500">No {filter === "All" ? "" : filter.toLowerCase() + " "}reviews yet.</p> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="p-3">Product</th><th className="p-3">Customer</th><th className="p-3">Rating</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y">
              {reviews.map((r) => (
                <tr key={r.id} className="align-middle">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {r.product_image ? <Img src={r.product_image} alt={r.product_title} sizes="48px" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="h-12 w-12 shrink-0 rounded-lg bg-gray-100" />}
                      <span className="max-w-[12rem] font-medium leading-snug">{r.product_title}</span>
                    </div>
                  </td>
                  <td className="p-3"><p className="font-medium">{r.user_name}</p><p className="break-all text-xs text-gray-500">{r.email || r.phone}</p></td>
                  <td className="p-3"><Stars value={r.rating} /><p className="mt-0.5 text-xs text-gray-400">{formatIst(r.created_at).split(",")[0]}</p></td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${BADGE[r.status] ?? BADGE.pending}`}>{r.status}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.active ? "bg-sky-100 text-sky-800" : "bg-gray-200 text-gray-600"}`}>{r.active ? "Active" : "Inactive"}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1.5">
                      <IconBtn kind="view" label={`View review by ${r.user_name}`} onClick={() => setModal({ kind: "view", id: r.id })} />
                      <IconBtn kind="edit" label={`Edit review by ${r.user_name}`} onClick={() => setModal({ kind: "edit", id: r.id })} />
                      <IconBtn kind="delete" label={`Delete review by ${r.user_name}`} disabled={busy === r.id} onClick={() => remove(r.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={pi.page} totalPages={pi.totalPages} total={pi.total} hrefFor={(p) => `/admin/reviews?${filter === "All" ? "" : `f=${filter}&`}page=${p}`} />

      {modal && current && (
        <Dialog onClose={() => setModal(null)} title={modal.kind === "view" ? "Review details" : "Edit review"}>
          {modal.kind === "view"
            ? <ViewBody r={current} busy={busy === current.id} onStatus={(s) => patch(current.id, { status: s }, s === "approved" ? "Approved — it is now public (if Active)" : s === "rejected" ? "Rejected" : "Moved back to pending")} onActive={(a) => patch(current.id, { active: a }, a ? "Review is Active" : "Review is Inactive — hidden from shoppers")} onEdit={() => setModal({ kind: "edit", id: current.id })} onDelete={() => remove(current.id)} />
            : <EditBody r={current} onDone={() => { setModal({ kind: "view", id: current.id }); router.refresh(); }} onCancel={() => setModal({ kind: "view", id: current.id })} />}
        </Dialog>
      )}
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-gray-500 hover:bg-gray-100">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Seg({ label, value, options, onChange, disabled }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
        {options.map(([v, text]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} disabled={disabled || value === v} onClick={() => onChange(v)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${value === v ? "bg-brand-600 text-white shadow-sm" : "text-gray-700 hover:bg-white"} disabled:cursor-default`}>{text}</button>
        ))}
      </div>
    </div>
  );
}

function ViewBody({ r, busy, onStatus, onActive, onEdit, onDelete }: { r: AdminReview; busy: boolean; onStatus: (s: string) => void; onActive: (a: boolean) => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {r.product_image ? <Img src={r.product_image} alt={r.product_title} sizes="64px" className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : <span className="h-16 w-16 shrink-0 rounded-lg bg-gray-100" />}
        <div className="min-w-0"><p className="font-semibold leading-snug">{r.product_title}</p><p className="text-sm text-gray-500">{r.user_name}</p><p className="break-all text-xs text-gray-400">{[r.email, r.phone].filter(Boolean).join(" · ")}</p></div>
      </div>
      <div className="rounded-lg border bg-gray-50 p-4">
        <div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} size="h-5 w-5" /><span className="text-sm font-semibold">{r.rating}/5</span><span className="text-xs text-gray-400">{formatIst(r.created_at)}</span></div>
        <p className="mt-2 whitespace-pre-line break-words text-gray-800">{r.comment}</p>
        <ReviewPhotos images={r.images} size="h-20 w-20" />
      </div>
      <div className="space-y-3 rounded-lg border p-4">
        <Seg label="Approval" value={r.status} disabled={busy} onChange={onStatus} options={[["pending", "Pending"], ["approved", "Approve"], ["rejected", "Reject"]]} />
        <Seg label="Visibility" value={r.active ? "active" : "inactive"} disabled={busy} onChange={(v) => onActive(v === "active")} options={[["active", "Active"], ["inactive", "Inactive"]]} />
        <p className="text-xs text-gray-500">Shoppers see a review only when it is <b>Approved</b> and <b>Active</b>. Approved reviews can no longer be edited or deleted by the customer.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-outline" onClick={onEdit}>Edit review</button>
        <button className="btn-danger" onClick={onDelete} disabled={busy}>Delete</button>
      </div>
    </div>
  );
}

function EditBody({ r, onDone, onCancel }: { r: AdminReview; onDone: () => void; onCancel: () => void }) {
  const [rating, setRating] = useState(r.rating), [comment, setComment] = useState(r.comment), [images, setImages] = useState(r.images);
  const [errs, setErrs] = useState<Errors>({}), [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = cleanReview({ rating, comment, images });
    const ve = validateReview(body); setErrs(ve);
    if (firstError(ve)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/reviews/${r.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) return toast.error((await res.json().catch(() => ({}))).error || "Could not save");
    toast.success("Review updated"); onDone();
  }
  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <p className="text-sm text-gray-500">{r.product_title} · {r.user_name}. Use this to correct a review (for example to remove a rude word). The status stays as it is.</p>
      <div><p className="mb-1 text-sm font-medium">Rating</p><StarInput value={rating} onChange={(n) => { setRating(n); setErrs((e) => ({ ...e, rating: "" })); }} /><FieldError msg={errs.rating} /></div>
      <label className="block text-sm font-medium">Review
        <textarea className={`input mt-1 ${errs.comment ? "!border-red-500" : ""}`} rows={5} maxLength={REVIEW_COMMENT_MAX} value={comment} onChange={(e) => { setComment(e.target.value); setErrs((x) => ({ ...x, comment: "" })); }} />
        <FieldError msg={errs.comment} />
      </label>
      {r.images.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Photos <span className="font-normal text-gray-400">(you can remove, not add)</span></p>
          <div className="flex flex-wrap gap-2">
            {r.images.map((u) => images.includes(u) ? (
              <div key={u} className="relative h-20 w-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="Review photo" className="h-full w-full rounded-lg border object-cover" />
                <button type="button" aria-label="Remove photo" onClick={() => setImages(images.filter((x) => x !== u))} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white">✕</button>
              </div>
            ) : null)}
            {images.length === 0 && <p className="text-sm text-gray-500">All photos removed.</p>}
          </div>
        </div>
      )}
      <div className="flex gap-2"><button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button><button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>Cancel</button></div>
    </form>
  );
}
