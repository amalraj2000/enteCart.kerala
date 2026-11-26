"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import IconBtn from "@/components/IconBtn";
import { toast } from "@/components/Toaster";
import Pagination from "@/components/Pagination";
import Req from "@/components/Req";
import FieldError from "@/components/FieldError";
import type { PageInfo } from "@/lib/paginate";
import { type Errors, VENDOR_NAME_MAX, cleanStaff, firstError, validateStaff } from "@/lib/validate";

type A = { id: number; name: string; vendor_name: string; email: string | null; phone: string | null; role: "admin" | "subadmin"; status: "active" | "inactive" | "blocked"; created_at: string };
const badge = { active: "bg-green-100 text-green-800", inactive: "bg-gray-200 text-gray-700", blocked: "bg-red-100 text-red-700" };

export default function AdminsManager({ admins, pi, meId }: { admins: A[]; pi: PageInfo; meId: number }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ role: "subadmin", name: "", vendor_name: "", identifier: "", password: "", confirm_password: "" });
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const login = (a: A) => a.email || a.phone || `#${a.id}`;

  const call = async (url: string, method: string, body?: unknown) => {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, error: (await r.json().catch(() => ({}))).error as string | undefined };
  };

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const v = cleanStaff(form), ve = validateStaff(v);
    if (v.role === "admin" && !form.confirm_password) ve.confirm_password = "Enter your own password to confirm";
    setErrs(ve);
    if (firstError(ve)) return toast.error("Please fix the highlighted fields");
    setBusy(true);
    const r = await call("/api/admin/admins", "POST", { ...v, confirm_password: form.confirm_password });
    setBusy(false);
    if (!r.ok) return toast.error(r.error || "Could not create the admin");
    toast.success(`${v.role === "admin" ? "Super admin" : "Sub admin"} ${v.name} created`); setAdding(false); router.refresh();
  }
  async function loginAs(a: A) {
    const r = await call(`/api/admin/admins/${a.id}/impersonate`, "POST", {});
    if (!r.ok) return toast.error(r.error || "Could not open this sub admin");
    router.push("/admin"); router.refresh();
  }
  async function remove(a: A) {
    if (!confirm(`Delete ${a.role === "admin" ? "super admin" : "sub admin"} ${a.name || login(a)}? They will lose access immediately.`)) return;
    let confirm_password = "";
    if (a.role === "admin") { confirm_password = window.prompt("Enter YOUR OWN password to confirm deleting a super admin:") || ""; if (!confirm_password) return; }
    const r = await call(`/api/admin/admins/${a.id}`, "DELETE", { confirm_password });
    r.ok ? toast.success("Admin deleted") : toast.error(r.error || "Could not delete");
    router.refresh();
  }
  const RoleBadge = ({ a }: { a: A }) => a.role === "admin"
    ? <span className="whitespace-nowrap rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Super admin</span>
    : <span className="whitespace-nowrap rounded-full border border-brand-600 px-3 py-1 text-xs font-semibold text-brand-700">Sub admin</span>;
  const Status = ({ a }: { a: A }) => <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold capitalize ${badge[a.status]}`}>{a.status}</span>;
  // The list only has Edit and Delete. Name, vendor name, login, status and password are all changed on the Edit page.
  const Actions = ({ a, cls }: { a: A; cls: string }) => a.id === meId ? <span className="text-xs text-gray-400">This is you</span> : (
    <>
      {a.role === "subadmin" && a.status === "active" && <button type="button" className="btn-primary !min-h-0 !px-2.5 !py-1" onClick={() => loginAs(a)} title="Login as this sub admin" aria-label={`Login as ${a.name || login(a)}`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></svg>
      </button>}
      <IconBtn kind="edit" label="Edit admin" href={`/admin/admins/${a.id}/edit`} />
      <IconBtn kind="delete" label="Delete admin" onClick={() => remove(a)} />
    </>
  );

  if (adding)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setAdding(false)}>← Back to admins</button>
          <h1 className="text-xl font-bold">Add admin</h1>
        </div>
        <form onSubmit={create} noValidate className="card max-w-lg space-y-4 p-5">
          <label className="block text-sm font-medium">Role<Req />
            <select className="input mt-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="subadmin">Sub admin — manages products, orders, users…</option>
              <option value="admin">Super admin — full access</option>
            </select>
          </label>
          <p className={`rounded-lg p-3 text-sm ${form.role === "admin" ? "bg-amber-50 text-amber-900" : "bg-brand-50 text-brand-900"}`}>
            {form.role === "admin"
              ? <>A <b>super admin</b> has full control: Admins, Settings, Payments and refunds, deleting users — everything. Only give this to someone you fully trust.</>
              : <>A sub admin can manage everything in the admin area <b>except the Admins, Settings and Payments menus</b>. They log in from the normal login box with the details below.</>}
          </p>
          <label className="block text-sm font-medium">Name<Req />
            <input className={`input mt-1 ${errs.name ? "!border-red-500" : ""}`} maxLength={50} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            <FieldError msg={errs.name} />
          </label>
          {form.role === "subadmin" && <label className="block text-sm font-medium">Vendor name<Req />
            <input className={`input mt-1 ${errs.vendor_name ? "!border-red-500" : ""}`} maxLength={VENDOR_NAME_MAX} value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} placeholder="e.g. Meera Traders" />
            <span className="mt-1 block text-xs font-normal text-gray-500">An internal label for this sub admin, shown only in the admin panel and used to welcome them. Customers always see “Sold by enteCart.kerala”.</span>
            <FieldError msg={errs.vendor_name} />
          </label>}
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
          {form.role === "admin" && <label className="block text-sm font-medium">Your own password (to confirm)<Req />
            <input className={`input mt-1 ${errs.confirm_password ? "!border-red-500" : ""}`} type="password" maxLength={72} autoComplete="current-password" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} />
            <span className="mt-1 block text-xs font-normal text-gray-500">Creating a super admin needs you to confirm it is really you.</span>
            <FieldError msg={errs.confirm_password} />
          </label>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy}>{busy ? "Creating…" : form.role === "admin" ? "Create super admin" : "Create sub admin"}</button>
            <button type="button" className="btn border" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold">Admins ({pi.total})</h1><p className="text-sm text-gray-500">Super admins and sub admins who run the shop.</p></div>
        <button className="btn-primary shrink-0" onClick={() => { setForm({ role: "subadmin", name: "", vendor_name: "", identifier: "", password: "", confirm_password: "" }); setErrs({}); setShowPw(false); setAdding(true); }}>+ Add admin</button>
      </div>

      {/* Phones: cards */}
      <ul className="space-y-3 md:hidden">
        {admins.map((a) => (
          <li key={a.id} className="card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">{(a.name || login(a))[0].toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{a.role === "subadmin" ? (a.vendor_name || a.name || "—") : (a.name && a.name !== "Admin" ? a.name : "Super admin")}{a.id === meId && <span className="ml-2 text-xs font-normal text-gray-400">(you)</span>}</p>
                {a.role === "subadmin" && a.vendor_name && a.name && <p className="truncate text-xs text-gray-500">Contact: {a.name}</p>}
                <p className="truncate text-sm text-gray-600">{a.email || "No email"}</p>
                <p className="text-sm text-gray-600">{a.phone || "No phone"}</p>
              </div>
              <div className="flex flex-col items-end gap-1"><RoleBadge a={a} /><Status a={a} /></div>
            </div>
            <p className="mt-2 text-xs text-gray-400">Added {a.created_at}</p>
            <div className="mt-3 grid grid-cols-2 gap-2"><Actions a={a} cls="w-full" /></div>
          </li>
        ))}
      </ul>

      {/* Tablet / desktop: table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="rtable w-full text-left text-sm">
          <thead className="bg-brand-50"><tr><th className="p-3">Name</th><th className="p-3">Vendor name</th><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Added</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-t">
                <td data-label="Name" className="p-3 font-medium">{a.name && a.name !== "Admin" ? a.name : a.role === "admin" ? "Super admin" : "—"}{a.id === meId && <span className="ml-2 text-xs font-normal text-gray-400">(you)</span>}</td>
                <td data-label="Vendor name" className="p-3 text-gray-700">{a.role === "subadmin" ? a.vendor_name || <span className="text-gray-400">not set</span> : "—"}</td>
                <td data-label="Email" className="p-3 text-gray-700">{a.email || "—"}</td>
                <td data-label="Phone" className="p-3 text-gray-700">{a.phone || "—"}</td>
                <td data-label="Role" className="p-3"><RoleBadge a={a} /></td>
                <td data-label="Status" className="p-3"><Status a={a} /></td>
                <td data-label="Added" className="whitespace-nowrap p-3 text-gray-600">{a.created_at.slice(0, 10)}</td>
                <td data-label="Actions" className="p-3"><div className="flex flex-wrap justify-end gap-1.5"><Actions a={a} cls="!min-h-0 !px-2.5 !py-1 text-xs" /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={pi.page} totalPages={pi.totalPages} total={pi.total} hrefFor={(p) => `/admin/admins${p > 1 ? `?page=${p}` : ""}`} />

    </div>
  );
}
