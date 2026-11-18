"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toaster";
import Pagination from "@/components/Pagination";
import type { PageInfo } from "@/lib/paginate";

type U = { id: number; name: string; email: string | null; phone: string | null; status: "active" | "inactive" | "blocked"; role: "user" | "admin"; created_at: string };
const badge = { active: "bg-green-100 text-green-800", inactive: "bg-gray-200 text-gray-700", blocked: "bg-red-100 text-red-700" };

export default function UsersTable({ users, pi }: { users: U[]; pi: PageInfo }) {
  const router = useRouter();
  const label = (u: U) => u.email || u.phone || `#${u.id}`;

  async function setStatus(u: U, status: U["status"], msg: string) {
    const r = await fetch(`/api/admin/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!r.ok) return toast.error("Could not update user");
    toast.success(msg);
    router.refresh();
  }
  async function remove(u: U) {
    if (!confirm(`Permanently delete ${label(u)}? This cannot be undone.`)) return;
    const r = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!r.ok) return toast.error("Could not delete user");
    toast.success("User deleted");
    router.refresh();
  }

  const Status = ({ u }: { u: U }) =>
    u.role === "admin"
      ? <span className="whitespace-nowrap rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Admin</span>
      : <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold capitalize ${badge[u.status]}`}>{u.status}</span>;

  // One set of actions, laid out by the caller (table cell on desktop, button grid on phones).
  const Actions = ({ u, cls }: { u: U; cls: string }) => (
    <>
      <Link href={`/admin/users/${u.id}`} className={`btn-outline ${cls}`}>View</Link>
      {u.role === "user" && u.status !== "active" && <button className={`btn-primary ${cls}`} onClick={() => setStatus(u, "active", `${label(u)} activated`)}>Activate</button>}
      {u.role === "user" && u.status === "active" && <button className={`btn border ${cls}`} onClick={() => setStatus(u, "inactive", `${label(u)} marked inactive`)}>Make inactive</button>}
      {u.role === "user" && u.status !== "blocked" && <button className={`btn border border-amber-500 text-amber-700 hover:bg-amber-50 ${cls}`} onClick={() => setStatus(u, "blocked", `${label(u)} blocked`)}>Block</button>}
      {u.role === "user" && <button className={`btn-danger ${cls}`} onClick={() => remove(u)}>Delete</button>}
    </>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Users ({pi.total})</h1>

      {/* Phones: one card per user */}
      <ul className="space-y-3 md:hidden">
        {users.map((u) => (
          <li key={u.id} className="card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">{(u.name || label(u))[0].toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/users/${u.id}`} className="block truncate font-semibold hover:text-brand-700">{u.name || "—"}</Link>
                <p className="truncate text-sm text-gray-600">{u.email || "No email"}</p>
                <p className="text-sm text-gray-600">{u.phone || "No phone"}</p>
              </div>
              <Status u={u} />
            </div>
            <p className="mt-2 text-xs text-gray-400">User #{u.id} · Registered {u.created_at}</p>
            <div className={`mt-3 grid gap-2 ${u.role === "admin" ? "grid-cols-1" : "grid-cols-2"}`}><Actions u={u} cls="w-full" /></div>
          </li>
        ))}
        {!users.length && <li className="card p-6 text-center text-gray-500">No users yet.</li>}
      </ul>

      {/* Tablet / desktop: table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-50"><tr><th className="p-3">ID</th><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Role / Status</th><th className="p-3">Registered</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.id}</td>
                <td className="p-3 font-medium"><Link href={`/admin/users/${u.id}`} className="hover:text-brand-700 hover:underline">{u.name || "—"}</Link></td>
                <td className="p-3 text-gray-700">{u.email || "—"}</td>
                <td className="p-3 text-gray-700">{u.phone || "—"}</td>
                <td className="p-3"><Status u={u} /></td>
                <td className="whitespace-nowrap p-3 text-gray-600">{u.created_at.slice(0, 10)}</td>
                <td className="p-3"><div className="flex flex-wrap justify-end gap-1.5"><Actions u={u} cls="!min-h-0 !px-2.5 !py-1 text-xs" /></div></td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={7} className="p-6 text-center text-gray-500">No users yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={pi.page} totalPages={pi.totalPages} total={pi.total} hrefFor={(p) => `/admin/users${p > 1 ? `?page=${p}` : ""}`} />
    </div>
  );
}
