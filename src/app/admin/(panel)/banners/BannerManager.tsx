"use client";
import IconBtn from "@/components/IconBtn";
import { largeSrc } from "@/lib/imgSrc";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toaster";
import Req from "@/components/Req";
import FieldError from "@/components/FieldError";
import { toPhoto } from "@/lib/image";
import { type Errors, cleanBanner, firstError, validateBanner } from "@/lib/validate";

export type Banner = { id: number; title: string; subtitle: string; button_text: string; link: string; image: string; position: number; active: number; editable?: boolean; added_by_name?: string | null };
const empty = { title: "", subtitle: "", button_text: "", link: "", image: "", active: true };

export default function BannerManager({ banners, isOwner = true }: { banners: Banner[]; isOwner?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, any>>(empty);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [open, setOpen] = useState(false);
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string) => (e: React.ChangeEvent<any>) => setForm({ ...form, [k]: e.target.value });

  async function upload(f?: File) {
    if (!f) return;
    setUploading(true);
    try {
      const data = await toPhoto(f, 1600); // wide banner: up to 1600px, compressed in the browser
      const r = await fetch("/api/admin/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Upload failed");
      setForm((x) => ({ ...x, image: d.url }));
    } catch (err) { toast.error((err as Error).message); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const clean = cleanBanner({ ...form, position: editing ? editing.position : 0 }); // new banners get their position from the server
    const ve = validateBanner(clean); setErrs(ve);
    if (firstError(ve)) return toast.error("Please fix the highlighted fields");
    setBusy(true);
    const r = await fetch(editing ? `/api/admin/banners/${editing.id}` : "/api/admin/banners", {
      method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? clean : { ...clean, position: undefined }),
    });
    setBusy(false);
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || "Could not save banner");
    toast.success(editing ? "Banner updated" : "Banner added"); setOpen(false); router.refresh();
  }
  async function del(b: Banner) {
    if (!confirm(`Delete banner "${b.title}"?`)) return;
    const r = await fetch(`/api/admin/banners/${b.id}`, { method: "DELETE" });
    r.ok ? toast.success("Banner deleted") : toast.error("Could not delete banner");
    router.refresh();
  }
  async function toggle(b: Banner) {
    const r = await fetch(`/api/admin/banners/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...b, active: !b.active }) });
    r.ok ? toast.success(b.active ? "Banner hidden" : "Banner is live") : toast.error("Could not update banner");
    router.refresh();
  }
  async function move(i: number, d: -1 | 1) {
    const a = banners[i], o = banners[i + d];
    if (!o) return;
    const put = (b: Banner, position: number) => fetch(`/api/admin/banners/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...b, position }) });
    // swap positions (equal positions are tie-broken by id, so nudge to keep them distinct)
    const [pa, po] = a.position === o.position ? [o.position + d, o.position] : [o.position, a.position];
    await Promise.all([put(a, pa), put(o, po)]);
    router.refresh();
  }

  if (open)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setOpen(false)} disabled={uploading}>← Back to banners</button>
          <h1 className="text-xl font-bold">{editing ? "Edit banner" : "Add banner"}</h1>
        </div>
        <form onSubmit={save} noValidate className="card grid max-w-3xl gap-3 p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Banner image <span className="font-normal">(optional — wide image, e.g. 1600×500. Without one, a green background is used)</span></label>
            <div className="relative h-36 overflow-hidden rounded-xl border bg-gradient-to-r from-brand-700 to-brand-500 sm:h-44">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {form.image && <img src={largeSrc(form.image)} alt="" className="absolute inset-0 h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
              <div className="relative flex h-full flex-col justify-center gap-1 px-5 text-white">
                <p className="text-xl font-extrabold drop-shadow">{form.title || "Banner title"}</p>
                <p className="text-sm text-white/90">{form.subtitle || "Subtitle"}</p>
                {form.button_text && <span className="mt-1 w-fit rounded-lg bg-white px-3 py-1 text-xs font-bold text-brand-700">{form.button_text}</span>}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <div className="mt-2 flex gap-2">
              <button type="button" className="btn-outline !py-1" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "Uploading…" : form.image ? "Change image" : "Upload image"}</button>
              {form.image && <button type="button" className="btn border !py-1" onClick={() => setForm({ ...form, image: "" })}>Remove image</button>}
            </div>
            <FieldError msg={errs.image} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Title<Req /><span className="float-right font-normal text-gray-400">{form.title.length}/60</span></label>
            <input className={`input ${errs.title ? "!border-red-500" : ""}`} maxLength={60} value={form.title} onChange={set("title")} placeholder="Onam Sale — up to 30% off" />
            <FieldError msg={errs.title} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Subtitle<span className="float-right font-normal text-gray-400">{form.subtitle.length}/120</span></label>
            <input className={`input ${errs.subtitle ? "!border-red-500" : ""}`} maxLength={120} value={form.subtitle} onChange={set("subtitle")} placeholder="Handloom sarees, mundus and more" />
            <FieldError msg={errs.subtitle} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Button text</label>
              <input className={`input ${errs.button_text ? "!border-red-500" : ""}`} maxLength={20} value={form.button_text} onChange={set("button_text")} placeholder="Shop now" />
              <FieldError msg={errs.button_text} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Button link</label>
              <input className={`input ${errs.link ? "!border-red-500" : ""}`} maxLength={300} value={form.link} onChange={set("link")} placeholder="/?category=1  or  https://…" />
              <FieldError msg={errs.link} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-brand-600" /> Show this banner on the home page</label>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy || uploading}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="btn border" onClick={() => setOpen(false)} disabled={uploading}>Cancel</button>
          </div>
        </form>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Banners ({banners.length})</h1><p className="text-sm text-gray-500">Promotional slider at the top of the home page. Shown in this order.</p></div>
        <button className="btn-primary" onClick={() => { setForm(empty); setEditing(null); setErrs({}); setOpen(true); }}>+ Add banner</button>
      </div>
      <div className="card divide-y">
        {banners.map((b, i) => (
          <div key={b.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="relative h-16 w-32 shrink-0 overflow-hidden rounded-lg bg-gradient-to-r from-brand-700 to-brand-500">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {b.image && <img src={largeSrc(b.image)} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1 basis-40">
              <p className="truncate font-medium">{b.title}</p>
              <p className="truncate text-xs text-gray-500">{b.subtitle || "—"}{b.button_text && ` · Button: ${b.button_text}`}</p>
              <p className="text-xs text-gray-400">Added by <span className="font-medium text-gray-600">{b.added_by_name || "—"}</span></p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>{b.active ? "Live" : "Hidden"}</span>
            {isOwner && (
              <div className="flex items-center gap-1">
                <button className="btn border !px-2 !py-1" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                <button className="btn border !px-2 !py-1" disabled={i === banners.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
              </div>
            )}
            {b.editable === false
              ? <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500" title="Created by another admin">View only</span>
              : (
                <div className="flex items-center gap-1">
                  <button className="btn border !py-1" onClick={() => toggle(b)}>{b.active ? "Hide" : "Show"}</button>
                  <IconBtn kind="edit" label="Edit banner" onClick={() => { setForm({ ...b, active: !!b.active }); setEditing(b); setErrs({}); setOpen(true); }} />
                  <IconBtn kind="delete" label="Delete banner" onClick={() => del(b)} />
                </div>
              )}
          </div>
        ))}
        {!banners.length && <p className="p-6 text-center text-gray-500">No banners yet — the home page shows a default green banner. Add one to start a slider.</p>}
      </div>
    </div>
  );
}
