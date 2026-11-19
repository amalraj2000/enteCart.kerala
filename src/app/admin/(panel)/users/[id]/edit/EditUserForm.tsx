"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toaster";
import FieldError from "@/components/FieldError";
import { type Errors, cleanAccount, firstError, validateAccount } from "@/lib/validate";

type U = { id: number; name: string; email: string; phone: string; status: string; created_at: string };

/** Full edit page for a customer: name, email, phone and status. Sub admins may only deactivate (the server enforces it too). */
export default function EditUserForm({ user, owner }: { user: U; owner: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ name: user.name, email: user.email, phone: user.phone, status: user.status });
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const statuses = owner ? ["active", "inactive", "blocked"] : user.status === "active" ? ["active", "inactive"] : [user.status];
  const desc: Record<string, string> = { active: "Active — can log in and order", inactive: "Inactive — cannot log in", blocked: "Blocked — cannot log in" };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    let body: Record<string, string>;
    if (owner) {
      const v = cleanAccount(f), ve = validateAccount(v, { nameRequired: false, vendor: false });
      setErrs(ve);
      if (firstError(ve)) return toast.error("Please fix the highlighted fields");
      body = { name: v.name, email: v.email, phone: v.phone, status: f.status };
    } else {
      if (f.status === user.status) return router.push("/admin/users");
      body = { status: f.status };
    }
    setBusy(true);
    const r = await fetch(`/api/admin/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || "Could not save");
    toast.success("User updated");
    router.push("/admin/users"); router.refresh();
  }

  const field = (k: "name" | "email" | "phone", label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-sm font-medium">{label}
      <input className={`input mt-1 ${errs[k] ? "!border-red-500" : ""} ${owner ? "" : "cursor-not-allowed bg-gray-100 text-gray-600"}`} value={f[k]} disabled={!owner}
        onChange={(e) => setF({ ...f, [k]: k === "phone" ? e.target.value.replace(/\D/g, "") : e.target.value })} {...extra} />
      <FieldError msg={errs[k]} />
    </label>
  );

  return (
    <form onSubmit={save} noValidate className="card max-w-lg space-y-4 p-5">
      <div><h1 className="text-xl font-bold">Edit user <span className="text-base font-medium text-gray-400">#{user.id}</span></h1><p className="text-sm text-gray-500">Registered {user.created_at}</p></div>
      {!owner && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Sub admins can only change the status, and only to Inactive. The super admin can edit everything.</p>}
      {field("name", "Name", { maxLength: 50, placeholder: "Customer name" })}
      {field("email", "Email (login)", { type: "email", maxLength: 100, placeholder: "name@gmail.com", autoComplete: "off" })}
      {field("phone", "Phone number (login)", { inputMode: "numeric", maxLength: 10, placeholder: "10 digits", autoComplete: "off" })}
      <label className="block text-sm font-medium">Status
        <select className="input mt-1" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} disabled={statuses.length < 2}>
          {statuses.map((s) => <option key={s} value={s}>{desc[s] || s}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        <Link href="/admin/users" className="btn border">Cancel</Link>
        <Link href={`/admin/users/${user.id}`} className="btn-outline ml-auto">View orders & addresses</Link>
      </div>
    </form>
  );
}
