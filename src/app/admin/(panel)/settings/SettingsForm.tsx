"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toaster";
import FieldError from "@/components/FieldError";
import { type Errors, cleanSettings, firstError, validateSettings } from "@/lib/validate";
import type { Settings } from "@/lib/settings";
import { THEMES, themeById, themeVars } from "@/lib/themes";

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

  // Live preview: picking a colour recolours this browser tab at once; nothing is saved (or visible to shoppers) until "Save settings".
  useEffect(() => {
    const root = document.documentElement, vars = themeVars(themeById(v.theme_color));
    for (const [k, val] of Object.entries(vars)) root.style.setProperty(k, val);
    return () => { for (const k of Object.keys(vars)) root.style.removeProperty(k); }; // leaving the page (or re-render) restores the saved colour
  }, [v.theme_color]);

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
      <div className="space-y-3 border-t pt-4">
        <div><h2 className="font-bold">Theme colour</h2><p className="text-sm text-gray-500">Pick a colour and the whole shop changes to it: buttons, links, badges and the admin panel. You can preview it here first. It goes live for shoppers when you press Save.</p></div>
        <div role="radiogroup" aria-label="Theme colour" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {THEMES.map((th) => {
            const on = v.theme_color === th.id;
            return (
              <button key={th.id} type="button" role="radio" aria-checked={on} onClick={() => setV({ ...v, theme_color: th.id })}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-2 text-xs font-medium transition ${on ? "border-gray-900 bg-gray-50" : "border-transparent hover:border-gray-300"}`}>
                <span className="relative flex h-10 w-full overflow-hidden rounded-md ring-1 ring-black/10" aria-hidden>
                  {([800, 600, 500, 200] as const).map((sh) => <span key={sh} className="flex-1" style={{ background: th.shades[sh] }} />)}
                  {on && <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow">✓</span>}
                </span>
                {th.name}
              </button>
            );
          })}
        </div>
        <FieldError msg={errs.theme_color} />
      </div>
      <div className="space-y-2 border-t pt-4">
        <div><h2 className="font-bold">Home page sections</h2><p className="text-sm text-gray-500">Turn a section off to hide it from the home page. Products themselves stay in the shop.</p></div>
        {([["show_highlights", "⭐ Highlighted products", "The row of products you mark as Highlighted in Admin → Products"], ["show_new_arrivals", "✨ New arrivals", "The row of the newest products"], ["show_best_sellers", "🔥 Best sellers", "The row of most-ordered products"]] as const).map(([k, label, sub]) => {
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
