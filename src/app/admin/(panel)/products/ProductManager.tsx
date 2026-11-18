"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Img from "@/components/Img";
import { toast } from "@/components/Toaster";
import Req from "@/components/Req";
import FieldError from "@/components/FieldError";
import Pagination from "@/components/Pagination";
import type { PageInfo } from "@/lib/paginate";
import { toPhoto } from "@/lib/image";
import { PRODUCT_MAX_IMAGES, PRODUCT_TITLE_MAX, type Errors, cleanProduct, firstError, validateProduct } from "@/lib/validate";
import { inr, productImages, type Category, type Product } from "@/lib/types";

const empty = { title: "", description: "", price: "", stock: "", sizes: "", category_id: "", images: [] as string[] };

export default function ProductManager({ products, categories, pi }: { products: Product[]; categories: Category[]; pi: PageInfo }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, any>>(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: string) => (e: React.ChangeEvent<any>) => setForm({ ...form, [k]: e.target.value });
  function edit(p: Product) { setForm({ ...p, category_id: p.category_id ?? "", images: productImages(p) }); setEditing(p.id); setOpen(true); setErrs({}); }
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
      method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clean),
    });
    setBusy(false);
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || "Could not save product");
    toast.success(editing ? "Product updated" : "Product added");
    setOpen(false); router.refresh();
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
        <form onSubmit={save} noValidate className="card grid gap-3 p-5 sm:grid-cols-2">
          {([
            ["title", "Title", "sm:col-span-2", { maxLength: PRODUCT_TITLE_MAX }],
            ["price", "Price (₹)", "", { type: "number", min: 1, max: 1000000, step: "0.01", inputMode: "decimal" }],
            ["stock", "Stock quantity", "", { type: "number", min: 0, max: 100000, step: 1, inputMode: "numeric" }],
            ["sizes", "Sizes, comma separated (S,M,L,XL)", "sm:col-span-2", { maxLength: 300 }],
          ] as const).map(([k, ph, span, attrs]) => (
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
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {!categories.length && <p className="mt-1 text-xs text-gray-400">No categories yet — add some under Categories in the sidebar.</p>}
            <FieldError msg={errs.category_id} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Product photos — the first one is the main photo</label>
            <div className="flex flex-wrap gap-3">
              {form.images.map((u: string, i: number) => (
                <div key={u + i} className="w-28">
                  <div className="relative">
                    <Img src={u} alt={`Photo ${i + 1}`} className="h-28 w-28 rounded-lg border object-cover" />
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
            <button className="btn-primary" disabled={busy || uploading > 0}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="btn border" onClick={() => setOpen(false)} disabled={uploading > 0}>Cancel</button>
          </div>
        </form>
      </div>
    );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Products ({pi.total})</h1>
        <button className="btn-primary" onClick={add}>+ Add product</button>
      </div>
      <div className="card divide-y">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3">
            <div className="relative shrink-0">
              <Img src={p.image_url} alt={p.title} className="h-14 w-14 rounded-lg object-cover" />
              {productImages(p).length > 1 && <span className="absolute -bottom-1 -right-1 rounded-full bg-brand-700 px-1.5 text-[10px] font-semibold text-white">{productImages(p).length}</span>}
            </div>
            <div className="flex-1">
              <p className="font-medium">{p.title}{p.category_name && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{p.category_name}</span>}</p>
              <p className="text-xs text-gray-500">{inr(p.price)} · Stock {p.stock}{p.sizes && ` · ${p.sizes}`}</p>
            </div>
            <button className="btn-outline !py-1" onClick={() => edit(p)}>Edit</button>
            <button className="btn-danger !py-1" onClick={() => del(p)}>Delete</button>
          </div>
        ))}
        {!products.length && <p className="p-6 text-center text-gray-500">No products.</p>}
      </div>
      <Pagination page={pi.page} totalPages={pi.totalPages} total={pi.total} hrefFor={(p) => `/admin/products${p > 1 ? `?page=${p}` : ""}`} />
    </div>
  );
}
