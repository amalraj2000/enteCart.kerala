"use client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/Providers";
import { toast } from "@/components/Toaster";
import { toAvatar } from "@/lib/image";
import Req from "@/components/Req";
import FieldError from "@/components/FieldError";
import { ADDRESS_LIMITS, type Errors, cleanAddress, firstError, validateAddress, validatePasswordChange } from "@/lib/validate";

export default function AccountPage() {
  const { user, authReady, openAuth, refreshUser } = useApp();
  const [tab, setTab] = useState<"profile" | "address" | "password">("profile");
  const [p, setP] = useState({ avatar: "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [addr, setAddr] = useState<Record<string, string>>({ state: "Kerala" });
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) setP({ avatar: user.avatar || "" });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the saved address (falls back to the latest order's address so it's never empty for returning customers).
  useEffect(() => {
    if (!user) return;
    (async () => {
      const saved = (await (await fetch("/api/auth/address")).json()).address;
      const full = user.name || "";
      if (saved) return setAddr(saved);
      const last = (await (await fetch("/api/orders")).json()).orders?.[0];
      if (last) setAddr({ customer_name: last.customer_name || full, phone: last.phone, house_name: last.house_name, street_name: last.street_name, city: last.city, state: last.state, pincode: last.pincode });
    })();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authReady) return null;
  if (!user) return <div className="card p-8 text-center"><p className="mb-3">Log in to manage your profile.</p><button className="btn-primary" onClick={() => openAuth()}>Login / Sign up</button></div>;

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try { setP({ ...p, avatar: await toAvatar(f) }); } catch (err) { toast.error((err as Error).message); }
  }
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/auth/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatar: p.avatar }) });
    setBusy(false);
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || "Could not save");
    toast.success("Profile saved successfully");
    refreshUser();
  }
  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    const clean = cleanAddress(addr);
    const ve = validateAddress(clean); setErrs(ve);
    if (firstError(ve)) return toast.error("Please fix the highlighted fields");
    setBusy(true);
    const r = await fetch("/api/auth/address", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clean) });
    setBusy(false);
    if (!r.ok) return toast.error((await r.json()).error);
    toast.success("Address saved successfully");
    refreshUser(); // the address Full Name is shown as the profile name
  }
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    const ve = validatePasswordChange(pw); setErrs(ve);
    if (firstError(ve)) return toast.error(firstError(ve)!);
    setBusy(true);
    const r = await fetch("/api/auth/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pw) });
    setBusy(false);
    if (!r.ok) return toast.error((await r.json()).error);
    setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
    toast.success("Password changed successfully");
  }
  const fullName = (addr.customer_name || user.name || "").trim();
  const initials = (fullName[0] || user.identifier[0]).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">Profile Settings</h1>
      <div className="mb-4 flex gap-1 border-b">
        {([["profile", "Profile"], ["address", "Address"], ["password", "Change Password"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setErrs({}); }} className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}>{l}</button>
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
                <button type="button" className="btn-outline" onClick={() => file.current?.click()}>Upload picture</button>
                {p.avatar && <button type="button" className="btn border" onClick={() => setP({ ...p, avatar: "" })}>Remove</button>}
              </div>
              <p className="text-xs text-gray-500">Square crop, saved at 256×256.</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Full name</p>
            <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              <span className={fullName ? "font-medium" : "text-gray-400"}>{fullName || "Not set yet"}</span>
              <button type="button" className="shrink-0 font-semibold text-brand-700 hover:underline" onClick={() => { setTab("address"); setErrs({}); }}>{fullName ? "Edit in Address tab" : "Add in Address tab"}</button>
            </div>
            <p className="mt-1 text-xs text-gray-500">Your name comes from the Full Name on your address.</p>
          </div>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2"><dt className="text-gray-500">Email</dt><dd className="break-all font-medium">{user.email || "—"}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500">Phone</dt><dd className="font-medium">{user.phone || "—"}</dd></div>
          </dl>
          <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </form>
      ) : tab === "address" ? (
        <form onSubmit={saveAddress} noValidate className="card space-y-4 p-6">
          <p className="text-sm text-gray-500">This address is filled in automatically at checkout. The Full Name here is also shown as your name in Profile.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {([["customer_name", "Full Name"], ["phone", "Phone Number"], ["house_name", "House Name"], ["street_name", "Street Name"], ["city", "City"], ["state", "State"], ["pincode", "Pincode"]] as const).map(([k, l]) => (
              <label key={k} className="text-sm font-medium">{l}<Req />
                <input className={`input mt-1 ${errs[k] ? "!border-red-500" : ""}`} value={addr[k] || ""} onChange={(e) => setAddr({ ...addr, [k]: k === "phone" || k === "pincode" ? e.target.value.replace(/\D/g, "") : e.target.value })}
                  onBlur={() => setErrs((x) => { const { [k]: _, ...rest } = x; const m = validateAddress(cleanAddress(addr))[k]; return m ? { ...rest, [k]: m } : rest; })}
                  inputMode={k === "phone" || k === "pincode" ? "numeric" : undefined} maxLength={k === "phone" ? 10 : k === "pincode" ? 6 : ADDRESS_LIMITS[k][1]} />
                <FieldError msg={errs[k]} />
              </label>
            ))}
          </div>
          <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save address"}</button>
        </form>
      ) : (
        <form onSubmit={savePassword} noValidate className="card max-w-md space-y-4 p-6">
          {(["currentPassword", "newPassword", "confirmPassword"] as const).map((k) => (
            <label key={k} className="block text-sm font-medium">
              {k === "currentPassword" ? "Current password" : k === "newPassword" ? "New password" : "Confirm new password"}<Req />
              <input className="input mt-1" type="password" maxLength={72} value={pw[k]} onChange={(e) => setPw({ ...pw, [k]: e.target.value })} autoComplete={k === "currentPassword" ? "current-password" : "new-password"} /><FieldError msg={errs[k]} />
            </label>
          ))}
          <button className="btn-primary" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
        </form>
      )}
    </div>
  );
}
