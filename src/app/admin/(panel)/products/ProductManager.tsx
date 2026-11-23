"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Img from "@/components/Img";
import IconBtn from "@/components/IconBtn";
import { toast } from "@/components/Toaster";
import Req from "@/components/Req";
import FieldError from "@/components/FieldError";
import Pagination from "@/components/Pagination";
import type { PageInfo } from "@/lib/paginate";
import { toPhoto } from "@/lib/image";
import { PRODUCT_MAX_IMAGES, PRODUCT_TITLE_MAX, type Errors, cleanProduct, firstError, validateProduct } from "@/lib/validate";
import { discountPct, inr, productImages, type Category, type Product } from "@/lib/types";

const empty = { title: "", description: "", price: "", original_price: "", meesho_price: "", stock: "", sizes: "", category_id: "", status: "active", video_url: "", product_link: "", images: [] as string[] };

export default function ProductManager({ products, categories, pi, staff, meId, by }: { products: (Product & { editable?: boolean })[]; categories: Category[]; pi: PageInfo; staff: { id: number; name: string }[]; meId: number; by: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, any>>(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [vidBusy, setVidBusy] = useState(false);
  async function uploadVideo(f: File | undefined) {
    if (!f) return;
    if (f.size > 4_000_000) return toast.error("Video is too large — max 4 MB (try a short clip, 720p or lower)");
    if (!/^video\/(mp4|webm)$/.test(f.type)) return toast.error("Only MP4 or WebM videos are allowed");
    setVidBusy(true);
    try {
      const r = await fetch("/api/admin/videos", { method: "POST", headers: { "Content-Type": f.type }, body: f });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) return toast.error(d.error || "Video upload failed");
      setForm((x: any) => ({ ...x, video_url: d.url })); toast.success("Video uploaded — press Save to keep it");
    } catch { toast.error("Network error while uploading the video"); } finally { setVidBusy(false); if (videoRef.current) videoRef.current.value = ""; }
  }

  const set = (k: string) => (e: React.ChangeEvent<any>) => setForm({ ...form, [k]: e.target.value });
  function edit(p: Product) { setForm({ ...p, stock_base: p.stock, original_price: p.original_price ? p.original_price : "", meesho_price: p.meesho_price ? p.meesho_price : "", category_id: p.category_id ?? "", status: p.status || "active", video_url: p.video_url || "", product_link: p.product_link || "", images: productImages(p) }); setEditing(p.id); setOpen(true); setErrs({}); }
  function add() { setForm(empty); setEditing(null); setOpen(true); setErrs({}); }

  const delImg = (i: number) => setForm({ ...form, images: form.images.filter((_: string, k: number) => k !== i) });
  const mainImg = (i: number) => setForm({ ...form, images: [form.images[i], ...form.images.filter((_: string, k: number) => k !== i)] });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const room = PRODUCT_MAX_IMAGES - form.images.length;
    const picked = [...files].slice(0, room);
    if (files.length > room) toast.error(`Only ${PRODUCT_MAX_IMAGES} photos allowed — ${files.length - room} skipped`);
    setUploading((n) => n + picked.length);
    const urls: string[] = [];
    for (const f of picked) {
      try {
        const data = await toPhoto(f); // resized + compressed in the browser
        const r = await fetch("/api/admin/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Upload failed");
        urls.push(d.url);
      } catch (err) { toast.error((err as Error).message); }
      setUploading((n) => n - 1);
    }
    if (urls.length) setForm((f: Record<string, any>) => ({ ...f, images: [...f.images, ...urls].slice(0, PRODUCT_MAX_IMAGES) }));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const clean = cleanProduct(form);
    const ve = validateProduct(clean); // same rules the server enforces
    setErrs(ve);
    if (firstError(ve)) return toast.error("Please fix the highlighted fields");
    setBusy(true);
    const r = await fetch(editing ? `/api/admin/products/${editing}` : "/api/admin/products", {
      method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? { ...clean, stock_base: form.stock_base } : clean),
    });
    setBusy(false);
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || "Could not save product");
    toast.success(editing ? "Product updated" : "Product added");
    setOpen(false); router.refresh();
  }
  async function toggleHighlight(p: Product) {
    const next = !p.highlighted;
    const r = await fetch(`/api/admin/products/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ highlighted: next }) });
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || "Could not change highlight");
    toast.success(next ? "Highlighted on the home page" : "Removed from highlights");
    router.refresh();
  }
  async function del(p: Product) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    const r = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
    r.ok ? toast.success("Product deleted") : toast.error("Could not delete product");
    router.refresh();
  }

  if (open)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setOpen(false)} disabled={uploading > 0}>← Back to products</button>
          <h1 className="text-xl font-bold">{editing ? "Edit product" : "Add product"}</h1>
        </div>
        {editing && <p className="text-sm text-gray-500">Added by <b className="text-gray-700">{products.find((x) => x.id === editing)?.added_by_name || "—"}</b></p>}
        <form onSubmit={save} noValidate className="card grid gap-3 p-5 sm:grid-cols-2">
          {([
            ["title", "Title", "sm:col-span-2", { maxLength: PRODUCT_TITLE_MAX }],
            ["price", "Selling price (₹)", "", { type: "number", min: 1, max: 1000000, step: "0.01", inputMode: "decimal" }],
            ["original_price", "Original price / MRP (₹) — optional", "", { type: "number", min: 1, max: 1000000, step: "0.01", inputMode: "decimal" }],
            ["meesho_price", "Meesho price / your cost (₹) — optional, admin only", "", { type: "number", min: 0, max: 1000000, step: "0.01", inputMode: "decimal" }],
            ["profit", "Your profit per piece — calculated (selling − Meesho price)", "", {}],
            ["discount", "Discount (%) — calculated automatically", "", {}],
            ["stock", "Stock quantity", "", { type: "number", min: 0, max: 100000, step: 1, inputMode: "numeric" }],
            ["sizes", "Sizes, comma separated (S,M,L,XL)", "sm:col-span-2", { maxLength: 300 }],
          ] as const).map(([k, ph, span, attrs]) => k === "profit" ? (
            <div key={k}>
              <label className="mb-1 block text-xs font-semibold text-gray-500">{ph}</label>
              <input className="input cursor-not-allowed bg-gray-100 text-gray-600" readOnly disabled tabIndex={-1} aria-readonly
                value={Number(form.meesho_price) > 0 && Number(form.price) > 0 ? `₹${(Number(form.price) - Number(form.meesho_price)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"} />
            </div>
          ) : k === "discount" ? (
            <div key={k}>
              <label className="mb-1 block text-xs font-semibold text-gray-500">{ph}</label>
              <input className="input cursor-not-allowed bg-gray-100 text-gray-600" readOnly disabled tabIndex={-1} aria-readonly
                value={discountPct(Number(form.price), Number(form.original_price)) > 0 ? `${discountPct(Number(form.price), Number(form.original_price))}% off` : "No discount"} />
            </div>
          ) : (
            <div key={k} className={span}>
              <label className="mb-1 block text-xs font-semibold text-gray-500">{ph}{(k === "title" || k === "price" || k === "stock") && <Req />}{k === "title" && <span className="float-right font-normal text-gray-400">{form.title.length}/{PRODUCT_TITLE_MAX}</span>}</label>
              <input className={`input ${errs[k] ? "!border-red-500" : ""}`} value={form[k]} onChange={set(k)} {...attrs} />
              <FieldError msg={errs[k]} />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Category</label>
            <select className={`input ${errs.category_id ? "!border-red-500" : ""}`} value={form.category_id} onChange={set("category_id")}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status === "inactive" ? " (inactive)" : ""}</option>)}
            </select>
            {!categories.length && <p className="mt-1 text-xs text-gray-400">No categories yet — add some under Categories in the sidebar.</p>}
            <FieldError msg={errs.category_id} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Status</label>
            <select className="input" value={form.status} onChange={set("status")}>
              <option value="active">Active — visible to customers</option>
              <option value="inactive">Inactive — hidden from customers</option>
            </select>
            {categories.find((c) => String(c.id) === String(form.category_id))?.status === "inactive" && <p className="mt-1 text-xs text-amber-700">This category is inactive, so the product stays hidden until the category is made active.</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Product link — optional, for your own reference (never shown to customers)</label>
            <input className={`input ${errs.product_link ? "!border-red-500" : ""}`} value={form.product_link} onChange={set("product_link")} maxLength={500} placeholder="https://…" inputMode="url" />
            <FieldError msg={errs.product_link} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Product video — optional: upload a short MP4/WebM (max 4 MB) or paste a YouTube link (Shorts work too), Vimeo or .mp4 link</label>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button type="button" className="btn border" disabled={vidBusy} onClick={() => videoRef.current?.click()}>{vidBusy ? "Uploading…" : "Upload video"}</button>
              {form.video_url && <button type="button" className="btn border text-red-600" onClick={() => setForm({ ...form, video_url: "" })}>Remove video</button>}
              {form.video_url?.startsWith("/api/videos/") && <span className="text-xs text-green-700">Uploaded video attached</span>}
              <input ref={videoRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => uploadVideo(e.target.files?.[0])} />
            </div>
            {form.video_url?.startsWith("/api/videos/") && <video src={form.video_url} controls preload="metadata" className="mb-2 aspect-video w-full max-w-sm rounded-lg bg-black" />}
            <input className={`input ${errs.video_url ? "!border-red-500" : ""}`} value={form.video_url} onChange={set("video_url")} maxLength={300} placeholder="https://www.youtube.com/shorts/…  or  https://youtu.be/…" inputMode="url" />
            <FieldError msg={errs.video_url} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Product photos — the first one is the main photo</label>
            <div className="flex flex-wrap gap-3">
              {form.images.map((u: string, i: number) => (
                <div key={u + i} className="w-28">
                  <div className="relative">
                    <Img src={u} alt={`Photo ${i + 1}`} sizes="112px" className="h-28 w-28 rounded-lg border object-cover" />
                    <button type="button" aria-label="Remove photo" onClick={() => delImg(i)} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-sm text-white shadow hover:bg-red-700">×</button>
                    {i === 0 && <span className="absolute bottom-1 left-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">Main</span>}
                  </div>
                  {i > 0 && <button type="button" className="mt-1 text-xs font-semibold text-brand-700 hover:underline" onClick={() => mainImg(i)}>Make main</button>}
                </div>
              ))}
              {Array.from({ length: uploading }).map((_, i) => (
                <div key={`u${i}`} className="flex h-28 w-28 animate-pulse items-center justify-center rounded-lg border bg-gray-100 text-xs text-gray-500">Uploading…</div>
              ))}
              {form.images.length + uploading < PRODUCT_MAX_IMAGES && (
                <button type="button" onClick={() => fileRef.current?.click()} className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-brand-200 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                  <span className="text-2xl leading-none">+</span>Upload photos
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            <p className="mt-2 text-xs text-gray-400">{form.images.length}/{PRODUCT_MAX_IMAGES} photos · JPG, PNG or WebP · you can select several at once</p>
            <FieldError msg={errs.images} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Description</label>
            <textarea className={`input ${errs.description ? "!border-red-500" : ""}`} rows={3} maxLength={2000} value={form.description} onChange={set("description")} />
            <FieldError msg={errs.description} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn-primary" disabled={busy || uploading > 0 || vidBusy}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="btn border" onClick={() => setOpen(false)} disabled={uploading > 0}>Cancel</button>
          </div>
        </form>
      </div>
    );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Products ({pi.total})</h1>
        <button className="btn-primary shrink-0" onClick={add}>+ Add product</button>
      </div>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <label htmlFor="by" className="text-gray-500">Added by</label>
        <select id="by" className="input !w-auto !py-1.5" value={by} onChange={(e) => router.push(e.target.value === "all" ? "/admin/products" : `/admin/products?by=${e.target.value}`)}>
          <option value="all">All admins</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.id === meId ? " (me)" : ""}</option>)}
        </select>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs text-gray-500">
            <tr><th className="p-3">Photo</th><th className="p-3">Name</th><th className="p-3">Status</th><th className="p-3">Category</th><th className="p-3">Stock</th><th className="p-3">Highlight</th><th className="p-3 text-right">Action</th></tr>
          </thead>
          <tbody className="divide-y">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="p-3">
                  <div className="relative w-14">
                    <Img src={p.image_url} alt={p.title} sizes="56px" className="h-14 w-14 rounded-lg object-cover" />
                    {productImages(p).length > 1 && <span className="absolute -bottom-1 -right-1 rounded-full bg-brand-700 px-1.5 text-[10px] font-semibold text-white">{productImages(p).length}</span>}
                  </div>
                </td>
                <td className="min-w-[12rem] p-3">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-gray-500">{inr(p.price)}{discountPct(p.price, p.original_price) > 0 && <> <span className="line-through">{inr(Number(p.original_price))}</span> <span className="font-semibold text-green-700">{discountPct(p.price, p.original_price)}% off</span></>}</p>
                  <p className="text-xs text-gray-400">Added by <span className="font-medium text-gray-600">{p.added_by_name || "—"}</span>{p.product_link && <> · <a href={p.product_link} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">Product link ↗</a></>}</p>
                </td>
                <td className="p-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === "inactive" ? "bg-gray-200 text-gray-600" : "bg-green-100 text-green-800"}`}>{p.status === "inactive" ? "Inactive" : "Active"}</span></td>
                <td className="p-3">{p.category_name ? <span className="whitespace-nowrap rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{p.category_name}</span> : <span className="text-xs text-gray-400">Uncategorised</span>}</td>
                <td className="p-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${Number(p.stock) === 0 ? "bg-red-100 text-red-700" : Number(p.stock) <= 5 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>{Number(p.stock) === 0 ? "Out of stock" : p.stock}</span></td>
                <td className="p-3">
                  <button type="button" role="switch" aria-checked={!!p.highlighted} aria-label={`Highlight ${p.title} on the home page`} disabled={p.editable === false}
                    onClick={() => toggleHighlight(p)} className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${p.highlighted ? "bg-brand-600" : "bg-gray-300"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${p.highlighted ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </td>
                <td className="p-3">
                  {p.editable === false
                    ? <span className="float-right whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500" title="Added by another admin">View only</span>
                    : <div className="flex justify-end gap-2"><IconBtn kind="edit" label={`Edit ${p.title}`} onClick={() => edit(p)} /><IconBtn kind="delete" label={`Delete ${p.title}`} onClick={() => del(p)} /></div>}
                </td>
              </tr>
            ))}
            {!products.length && <tr><td colSpan={7} className="p-6 text-center text-gray-500">No products.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={pi.page} totalPages={pi.totalPages} total={pi.total} hrefFor={(p) => `/admin/products?${new URLSearchParams({ ...(by !== "all" ? { by } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`} />
    </div>
  );
}
