"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toaster";
import Pagination from "@/components/Pagination";
import Req from "@/components/Req";
import FieldError from "@/components/FieldError";
import type { PageInfo } from "@/lib/paginate";
import { type Errors, cleanStaff, firstError, validatePassword, validateStaff } from "@/lib/validate";

type A = { id: number; name: string; email: string | null; phone: string | null; role: "admin" | "subadmin"; status: "active" | "inactive" | "blocked"; created_at: string };
const badge = { active: "bg-green-100 text-green-800", inactive: "bg-gray-200 text-gray-700", blocked: "bg-red-100 text-red-700" };

export default function AdminsManager({ admins, pi, meId }: { admins: A[]; pi: PageInfo; meId: number }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", identifier: "", password: "" });
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [reset, setReset] = useState<A | null>(null);
  const [newPw, setNewPw] = useState("");
  const [resetErr, setResetErr] = useState<string | null>(null);
  const login = (a: A) => a.email || a.phone || `#${a.id}`;

  const call = async (url: string, method: string, body?: unknown) => {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, error: (await r.json().catch(() => ({}))).error as string | undefined };
  };

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const v = cleanStaff(form), ve = validateStaff(v); setErrs(ve);
    if (firstError(ve)) return toast.error("Please fix the highlighted fields");
    setBusy(true);
    const r = await call("/api/admin/admins", "POST", v);
    setBusy(false);
    if (!r.ok) return toast.error(r.error || "Could not create sub-admin");
    toast.success(`Sub-admin ${v.name} created`); setAdding(false); router.refresh();
  }
  async function setStatus(a: A, status: A["status"], msg: string) {
    const r = await call(`/api/admin/admins/${a.id}`, "PATCH", { status });
    r.ok ? toast.success(msg) : toast.error(r.error || "Could not update");
    router.refresh();
  }
  async function remove(a: A) {
    if (!confirm(`Delete sub-admin ${a.name || login(a)}? They will lose access immediately.`)) return;
    const r = await call(`/api/admin/admins/${a.id}`, "DELETE");
    r.ok ? toast.success("Sub-admin deleted") : toast.error(r.error || "Could not delete");
    router.refresh();
  }
  async function doReset(e: React.FormEvent) {
    e.preventDefault();
    const m = validatePassword(newPw, "Password"); setResetErr(m);
    if (m || !reset) return;
    const r = await call(`/api/admin/admins/${reset.id}`, "PATCH", { password: newPw });
    if (!r.ok) return toast.error(r.error || "Could not reset password");
    toast.success(`Password reset for ${reset.name || login(reset)}`); setReset(null); setNewPw("");
  }

  const RoleBadge = ({ a }: { a: A }) => a.role === "admin"
    ? <span className="whitespace-nowrap rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Admin</span>
    : <span className="whitespace-nowrap rounded-full border border-brand-600 px-3 py-1 text-xs font-semibold text-brand-700">Sub-admin</span>;
  const Status = ({ a }: { a: A }) => <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold capitalize ${badge[a.status]}`}>{a.status}</span>;
  const Actions = ({ a, cls }: { a: A; cls: string }) => a.role !== "subadmin" ? <span className="text-xs text-gray-400">Main account</span> : (
    <>
      {a.status !== "active" && <button className={`btn-primary ${cls}`} onClick={() => setStatus(a, "active", `${login(a)} activated`)}>Activate</button>}
      {a.status === "active" && <button className={`btn border ${cls}`} onClick={() => setStatus(a, "inactive", `${login(a)} deactivated`)}>Deactivate</button>}
      {a.status !== "blocked" && <button className={`btn border border-amber-500 text-amber-700 hover:bg-amber-50 ${cls}`} onClick={() => setStatus(a, "blocked", `${login(a)} blocked`)}>Block</button>}
      <button className={`btn-outline ${cls}`} onClick={() => { setReset(a); setNewPw(""); setResetErr(null); }}>Reset password</button>
      <button className={`btn-danger ${cls}`} onClick={() => remove(a)}>Delete</button>
    </>
  );

  if (adding)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setAdding(false)}>← Back to admins</button>
          <h1 className="text-xl font-bold">Add sub-admin</h1>
        </div>
        <form onSubmit={create} noValidate className="card max-w-lg space-y-4 p-5">
          <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-900">A sub-admin can manage everything in the admin area <b>except the Admins menu</b>. They log in from the normal login box with the details below.</p>
          <label className="block text-sm font-medium">Name<Req />
            <input className={`input mt-1 ${errs.name ? "!border-red-500" : ""}`} maxLength={50} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            <FieldError msg={errs.name} />
          </label>
          <label className="block text-sm font-medium">Login — email or 10-digit phone<Req />
            <input className={`input mt-1 ${errs.identifier ? "!border-red-500" : ""}`} maxLength={100} autoComplete="off" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} placeholder="staff@example.com" />
            <FieldError msg={errs.identifier} />
          </label>
          <label className="block text-sm font-medium">Password<Req />
            <div className="relative mt-1">
              <input className={`input pr-16 ${errs.password ? "!border-red-500" : ""}`} type={showPw ? "text" : "password"} maxLength={72} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold text-brand-700" onClick={() => setShowPw(!showPw)}>{showPw ? "Hide" : "Show"}</button>
            </div>
            <span className="mt-1 block text-xs font-normal text-gray-500">6–72 characters. Share it securely — they can change it later from their Account page.</span>
            <FieldError msg={errs.password} />
          </label>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy}>{busy ? "Creating…" : "Create sub-admin"}</button>
            <button type="button" className="btn border" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold">Admins ({pi.total})</h1><p className="text-sm text-gray-500">The main admin and sub-admins who help run the shop.</p></div>
        <button className="btn-primary shrink-0" onClick={() => { setForm({ name: "", identifier: "", password: "" }); setErrs({}); setShowPw(false); setAdding(true); }}>+ Add sub-admin</button>
      </div>

      {/* Phones: cards */}
      <ul className="space-y-3 md:hidden">
        {admins.map((a) => (
          <li key={a.id} className="card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">{(a.name || login(a))[0].toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{a.name || "—"}{a.id === meId && <span className="ml-2 text-xs font-normal text-gray-400">(you)</span>}</p>
                <p className="truncate text-sm text-gray-600">{a.email || "No email"}</p>
                <p className="text-sm text-gray-600">{a.phone || "No phone"}</p>
              </div>
              <div className="flex flex-col items-end gap-1"><RoleBadge a={a} />{a.role === "subadmin" && <Status a={a} />}</div>
            </div>
            <p className="mt-2 text-xs text-gray-400">Added {a.created_at}</p>
            {a.role === "subadmin" && <div className="mt-3 grid grid-cols-2 gap-2"><Actions a={a} cls="w-full" /></div>}
          </li>
        ))}
      </ul>

      {/* Tablet / desktop: table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-50"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Added</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-3 font-medium">{a.name || "—"}{a.id === meId && <span className="ml-2 text-xs font-normal text-gray-400">(you)</span>}</td>
                <td className="p-3 text-gray-700">{a.email || "—"}</td>
                <td className="p-3 text-gray-700">{a.phone || "—"}</td>
                <td className="p-3"><RoleBadge a={a} /></td>
                <td className="p-3">{a.role === "subadmin" ? <Status a={a} /> : <span className="text-gray-400">—</span>}</td>
                <td className="whitespace-nowrap p-3 text-gray-600">{a.created_at.slice(0, 10)}</td>
                <td className="p-3"><div className="flex flex-wrap justify-end gap-1.5"><Actions a={a} cls="!min-h-0 !px-2.5 !py-1 text-xs" /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={pi.page} totalPages={pi.totalPages} total={pi.total} hrefFor={(p) => `/admin/admins${p > 1 ? `?page=${p}` : ""}`} />

      {reset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={doReset} noValidate className="card w-full max-w-sm space-y-3 p-5">
            <div className="flex items-start justify-between"><h2 className="text-lg font-bold text-brand-700">Reset password</h2><button type="button" className="text-2xl leading-none text-gray-400" onClick={() => setReset(null)} aria-label="Close">×</button></div>
            <p className="text-sm text-gray-600">New password for <b>{reset.name || login(reset)}</b>. Their current password stops working immediately.</p>
            <input className={`input ${resetErr ? "!border-red-500" : ""}`} type="text" autoComplete="off" maxLength={72} placeholder="New password (6–72 characters)" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoFocus />
            <FieldError msg={resetErr ?? undefined} />
            <button className="btn-primary w-full">Set new password</button>
          </form>
        </div>
      )}
    </div>
  );
}
