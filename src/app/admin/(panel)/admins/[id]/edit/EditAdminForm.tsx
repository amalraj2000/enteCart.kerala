"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toaster";
import Req from "@/components/Req";
import FieldError from "@/components/FieldError";
import { STAFF_PASSWORD_MIN, type Errors, VENDOR_NAME_MAX, cleanAccount, firstError, validateAccount, validatePassword } from "@/lib/validate";

type A = { id: number; role: string; name: string; vendor_name: string; email: string; phone: string; status: string; created_at: string };

/** Full edit page for a sub admin or super admin: role, name, vendor name, login email / phone, status and (optionally) a new password. */
export default function EditAdminForm({ admin }: { admin: A }) {
  const router = useRouter();
  const [f, setF] = useState({ role: admin.role, confirm_password: "", name: admin.name, vendor_name: admin.vendor_name, email: admin.email, phone: admin.phone, status: admin.status, password: "" });
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Sensitive changes to a super admin (or to anyone's role) need the acting admin's own password.
  const loginChanged = !!f.password || f.email.trim().toLowerCase() !== (admin.email || "") || f.phone.replace(/\s+/g, "") !== (admin.phone || "") || f.status !== admin.status;
  const needsConfirm = f.role !== admin.role || (admin.role === "admin" && loginChanged);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const v = cleanAccount(f), ve = validateAccount(v, { nameRequired: true, vendor: f.role === "subadmin" });
    const roleChanged = f.role !== admin.role;
    if (needsConfirm && !f.confirm_password) ve.confirm_password = "Enter your own password to confirm";
    if (f.password) { const pe = validatePassword(f.password, "Password", STAFF_PASSWORD_MIN); if (pe) ve.password = pe; }
    setErrs(ve);
    if (firstError(ve)) return toast.error("Please fix the highlighted fields");
    setBusy(true);
    const r = await fetch(`/api/admin/admins/${admin.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: f.role, confirm_password: f.confirm_password, name: v.name, vendor_name: v.vendor_name, email: v.email, phone: v.phone, status: f.status, password: f.password }) });
    setBusy(false);
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || "Could not save");
    toast.success(roleChanged ? `Now a ${f.role === "admin" ? "super admin" : "sub admin"}` : "Admin updated");
    router.push("/admin/admins"); router.refresh();
  }

  const input = (k: "name" | "vendor_name" | "email" | "phone", label: string, req: boolean, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <label className="block text-sm font-medium">{label}{req && <Req />}
      <input className={`input mt-1 ${errs[k] ? "!border-red-500" : ""}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: k === "phone" ? e.target.value.replace(/\D/g, "") : e.target.value })} {...extra} />
      {hint && !errs[k] && <span className="mt-1 block text-xs font-normal text-gray-500">{hint}</span>}
      <FieldError msg={errs[k]} />
    </label>
  );

  return (
    <form onSubmit={save} noValidate className="card max-w-lg space-y-4 p-5">
      <div><h1 className="text-xl font-bold">Edit admin <span className="text-base font-medium text-gray-400">#{admin.id}</span></h1><p className="text-sm text-gray-500">Added {admin.created_at}</p></div>
      <label className="block text-sm font-medium">Role
        <select className="input mt-1" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="subadmin">Sub admin — manages products, orders, users…</option>
          <option value="admin">Super admin — full access</option>
        </select>
      </label>
      {needsConfirm && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{f.role === admin.role ? <>You are changing a <b>super admin</b>&apos;s login details, status or password.</> : f.role === "admin"
            ? <>You are making this person a <b>super admin</b>: full control of Admins, Settings, Payments and refunds, and deleting users.</>
            : <>You are making this person a <b>sub admin</b>: they lose access to Admins, Settings and Payments straight away.</>}</p>
          <label className="block font-medium">Your own password (to confirm)<Req />
            <input className={`input mt-1 ${errs.confirm_password ? "!border-red-500" : ""}`} type="password" maxLength={72} autoComplete="current-password" value={f.confirm_password} onChange={(e) => setF({ ...f, confirm_password: e.target.value })} />
            <FieldError msg={errs.confirm_password} />
          </label>
        </div>
      )}
      {input("name", "Name", true, { maxLength: 50 })}
      {f.role === "subadmin" && input("vendor_name", "Vendor name", true, { maxLength: VENDOR_NAME_MAX, placeholder: "e.g. Meera Traders" }, "An internal label shown only in the admin panel. Customers always see “Sold by enteCart.kerala”.")}
      {input("email", "Email (login)", false, { type: "email", maxLength: 100, autoComplete: "off" })}
      {input("phone", "Phone number (login)", false, { inputMode: "numeric", maxLength: 10, autoComplete: "off" }, "Add an email, a phone number, or both.")}
      <label className="block text-sm font-medium">Status
        <select className="input mt-1" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="active">Active — can use the admin panel</option>
          <option value="inactive">Inactive — cannot log in</option>
          <option value="blocked">Blocked — cannot log in</option>
        </select>
      </label>
      <label className="block text-sm font-medium">New password <span className="font-normal text-gray-400">(optional)</span>
        <div className="relative mt-1">
          <input className={`input pr-16 ${errs.password ? "!border-red-500" : ""}`} type={showPw ? "text" : "password"} maxLength={72} autoComplete="new-password" placeholder="Leave empty to keep the current password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold text-brand-700" onClick={() => setShowPw(!showPw)}>{showPw ? "Hide" : "Show"}</button>
        </div>
        <span className="mt-1 block text-xs font-normal text-gray-500">If you set one, their old password stops working immediately.</span>
        <FieldError msg={errs.password} />
      </label>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        <Link href="/admin/admins" className="btn border">Cancel</Link>
      </div>
    </form>
  );
}
