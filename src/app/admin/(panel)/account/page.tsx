"use client";
import { useEffect, useRef, useState } from "react";
import Req from "@/components/Req";
import { toast } from "@/components/Toaster";
import { toAvatar } from "@/lib/image";
import { STAFF_PASSWORD_MIN, cleanProfile, firstError, validatePasswordChange, validateProfile } from "@/lib/validate";

type Msg = { ok: boolean; text: string } | null;

export default function AccountPage() {
  const [tab, setTab] = useState<"profile" | "password">("profile");
  const [p, setP] = useState({ username: "", name: "", avatar: "" });
  const [pm, setPm] = useState<Msg>(null);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [wm, setWm] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => { fetch("/api/admin/profile").then((r) => r.json()).then(setP); }, []);

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try { setP({ ...p, avatar: await toAvatar(f) }); } catch (err) { toast.error((err as Error).message); }
  }
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setPm(null);
    const clean = cleanProfile(p);
    const ve = firstError(validateProfile(clean)); // same rules the server enforces
    if (ve) { toast.error(ve); return setPm({ ok: false, text: ve }); }
    setBusy(true);
    const r = await fetch("/api/admin/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clean) });
    setBusy(false);
    if (!r.ok) { const m = (await r.json().catch(() => ({}))).error || "Request failed"; toast.error(m); return setPm({ ok: false, text: m }); }
    setPm(null); toast.success("Profile saved successfully");
    window.dispatchEvent(new Event("admin-profile-updated"));
  }
  async function savePassword(e: React.FormEvent) {
    e.preventDefault(); setWm(null);
    const ve = firstError(validatePasswordChange(pw, STAFF_PASSWORD_MIN));
    if (ve) { toast.error(ve); return setWm({ ok: false, text: ve }); }
    setBusy(true);
    const r = await fetch("/api/admin/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pw) });
    setBusy(false);
    if (!r.ok) { const m = (await r.json().catch(() => ({}))).error || "Request failed"; toast.error(m); return setWm({ ok: false, text: m }); }
    setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setWm(null); toast.success("Password changed successfully");
  }
  const initials = (p.name[0] || p.username[0] || "A").toUpperCase();
  const Message = ({ m }: { m: Msg }) => m && <p className={`text-sm ${m.ok ? "text-brand-700" : "text-red-600"}`}>{m.text}</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">My Account</h1>
      <div className="mb-4 flex gap-1 border-b">
        {([["profile", "Profile"], ["password", "Change Password"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}>{l}</button>
        ))}
      </div>

      {tab === "profile" ? (
        <form onSubmit={saveProfile} noValidate className="card space-y-5 p-6">
          <div className="flex items-center gap-5">
            {p.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.avatar} alt="Profile" className="h-24 w-24 rounded-full object-cover ring-4 ring-brand-100" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-600 text-3xl font-bold text-white ring-4 ring-brand-100">{initials}</div>
            )}
            <div className="space-y-2">
              <input ref={file} type="file" accept="image/*" className="hidden" onChange={pickImage} />
              <div className="flex gap-2">
                <button type="button" className="btn-outline" onClick={() => file.current?.click()}>Upload image</button>
                {p.avatar && <button type="button" className="btn border" onClick={() => setP({ ...p, avatar: "" })}>Remove</button>}
              </div>
              <p className="text-xs text-gray-500">Square crop, saved at 256×256.</p>
            </div>
          </div>
          <label className="block text-sm font-medium">Name<Req />
            <input className="input mt-1" maxLength={50} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          </label>
          <p className="text-xs text-gray-500">Login email: <b>{p.username}</b></p>
          <Message m={pm} />
          <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </form>
      ) : (
        <form onSubmit={savePassword} noValidate className="card max-w-md space-y-4 p-6">
          {(["currentPassword", "newPassword", "confirmPassword"] as const).map((k) => (
            <label key={k} className="block text-sm font-medium">
              {k === "currentPassword" ? "Current password" : k === "newPassword" ? "New password" : "Confirm new password"}<Req />
              <input className="input mt-1" type="password" maxLength={72} value={pw[k]} onChange={(e) => setPw({ ...pw, [k]: e.target.value })} autoComplete={k === "currentPassword" ? "current-password" : "new-password"} />
            </label>
          ))}
          <Message m={wm} />
          <button className="btn-primary" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
        </form>
      )}
    </div>
  );
}
