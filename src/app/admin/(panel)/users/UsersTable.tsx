"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/Toaster";
import Pagination from "@/components/Pagination";
import type { PageInfo } from "@/lib/paginate";

type U = { id: number; name: string; email: string | null; phone: string | null; status: "active" | "inactive" | "blocked"; role: "user" | "admin"; created_at: string };
const badge = { active: "bg-green-100 text-green-800", inactive: "bg-gray-200 text-gray-700", blocked: "bg-red-100 text-red-700" };

export default function UsersTable({ users, pi }: { users: U[]; pi: PageInfo }) {
  const router = useRouter();

  async function setStatus(u: U, status: U["status"], msg: string) {
    const r = await fetch(`/api/admin/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!r.ok) return toast.error("Could not update user");
    toast.success(msg);
    router.refresh();
  }
  async function remove(u: U) {
    if (!confirm(`Permanently delete ${(u.email || u.phone)}? This cannot be undone.`)) return;
    const r = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!r.ok) return toast.error("Could not delete user");
    toast.success("User deleted");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Users ({pi.total})</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-50"><tr><th className="p-3">ID</th><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Role / Status</th><th className="p-3">Registered</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.id}</td>
                <td className="p-3 font-medium"><Link href={`/admin/users/${u.id}`} className="hover:text-brand-700 hover:underline">{u.name || "—"}</Link></td>
                <td className="p-3 text-gray-700">{u.email || "—"}</td>
                <td className="p-3 text-gray-700">{u.phone || "—"}</td>
                <td className="p-3">{u.role === "admin" ? <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Admin</span> : <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badge[u.status]}`}>{u.status}</span>}</td>
                <td className="p-3 text-gray-600">{u.created_at}</td>
                <td className="p-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link href={`/admin/users/${u.id}`} className="btn-outline !py-1">View</Link>
                    {u.role === "user" && u.status !== "active" && <button className="btn-primary !py-1" onClick={() => setStatus(u, "active", `${(u.email || u.phone)} activated`)}>Activate</button>}
                    {u.role === "user" && u.status === "active" && <button className="btn border !py-1" onClick={() => setStatus(u, "inactive", `${(u.email || u.phone)} marked inactive`)}>Make inactive</button>}
                    {u.role === "user" && u.status !== "blocked" && <button className="btn border border-amber-500 !py-1 text-amber-700 hover:bg-amber-50" onClick={() => setStatus(u, "blocked", `${(u.email || u.phone)} blocked`)}>Block</button>}
                    {u.role === "user" && <button className="btn-danger !py-1" onClick={() => remove(u)}>Delete</button>}
                  </div>
                </td>
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
