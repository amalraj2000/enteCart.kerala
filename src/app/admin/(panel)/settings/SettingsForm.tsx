"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toaster";
import FieldError from "@/components/FieldError";
import { type Errors, cleanSettings, firstError, validateSettings } from "@/lib/validate";
import type { Settings } from "@/lib/settings";

const FIELDS: [keyof Settings, string, string, "input" | "textarea", string?][] = [
  ["shop_about", "About the shop (footer & About page)", "Kerala's friendly online store…", "textarea", "Max 250 characters"],
  ["shop_phone", "Phone number", "10 digits", "input", "Shown in the footer and Contact page"],
  ["shop_whatsapp", "WhatsApp number", "e.g. 9544437950", "input", "Adds a WhatsApp link and icon"],
  ["shop_email", "Email", "hello@example.com", "input"],
  ["shop_address", "Address", "Shop name, street, town, district, pincode", "textarea"],
  ["shop_hours", "Opening hours", "Mon–Sat, 9 AM – 7 PM", "input"],
  ["social_instagram", "Instagram link", "https://instagram.com/yourshop", "input"],
  ["social_facebook", "Facebook link", "https://facebook.com/yourshop", "input"],
  ["social_youtube", "YouTube link", "https://youtube.com/@yourshop", "input"],
];

export default function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [v, setV] = useState<Settings>(initial);
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const clean = cleanSettings(v);
    const ve = validateSettings(clean); setErrs(ve);
    if (firstError(ve)) return toast.error("Please fix the highlighted fields");
    setBusy(true);
    const r = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clean) });
    setBusy(false);
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || "Could not save");
    toast.success("Settings saved"); router.refresh();
  }

  return (
    <form onSubmit={save} noValidate className="card max-w-2xl space-y-4 p-6">
      <div><h1 className="text-xl font-bold">Shop details</h1><p className="text-sm text-gray-500">Shown in the website footer, About and Contact pages. Leave a field empty to hide it.</p></div>
      {FIELDS.map(([k, label, ph, kind, hint]) => (
        <label key={k} className="block text-sm font-medium">{label}
          {kind === "textarea"
            ? <textarea className={`input mt-1 ${errs[k] ? "!border-red-500" : ""}`} rows={k === "shop_about" ? 3 : 2} placeholder={ph} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
            : <input className={`input mt-1 ${errs[k] ? "!border-red-500" : ""}`} placeholder={ph} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
          {hint && !errs[k] && <span className="mt-1 block text-xs font-normal text-gray-400">{hint}</span>}
          <FieldError msg={errs[k]} />
        </label>
      ))}
      <div className="space-y-2 border-t pt-4">
        <div><h2 className="font-bold">Home page sections</h2><p className="text-sm text-gray-500">Turn a section off to hide it from the home page. Products themselves stay in the shop.</p></div>
        {([["show_new_arrivals", "✨ New arrivals", "The row of the newest products"], ["show_best_sellers", "🔥 Best sellers", "The row of most-ordered products"]] as const).map(([k, label, sub]) => {
          const on = v[k] !== "0";
          return (
            <div key={k} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-gray-500">{sub}</p></div>
              <button type="button" role="switch" aria-checked={on} aria-label={`${label} section`} onClick={() => setV({ ...v, [k]: on ? "0" : "1" })}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-brand-600" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                <span className="sr-only">{on ? "On" : "Off"}</span>
              </button>
            </div>
          );
        })}
      </div>
      <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
