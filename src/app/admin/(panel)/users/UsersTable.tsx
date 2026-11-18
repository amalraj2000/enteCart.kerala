"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/Toaster";
import Pagination from "@/components/Pagination";
import type { PageInfo } from "@/lib/paginate";

type U = { id: number; identifier: string; status: "active" | "inactive" | "blocked"; created_at: string };
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
    if (!confirm(`Permanently delete ${u.identifier}? This cannot be undone.`)) return;
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
          <thead className="bg-brand-50"><tr><th className="p-3">ID</th><th className="p-3">Phone / Gmail</th><th className="p-3">Status</th><th className="p-3">Registered</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.id}</td>
                <td className="p-3 font-medium"><Link href={`/admin/users/${u.id}`} className="hover:text-brand-700 hover:underline">{u.identifier}</Link></td>
                <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badge[u.status]}`}>{u.status}</span></td>
                <td className="p-3 text-gray-600">{u.created_at}</td>
                <td className="p-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link href={`/admin/users/${u.id}`} className="btn-outline !py-1">View</Link>
                    {u.status !== "active" && <button className="btn-primary !py-1" onClick={() => setStatus(u, "active", `${u.identifier} activated`)}>Activate</button>}
                    {u.status === "active" && <button className="btn border !py-1" onClick={() => setStatus(u, "inactive", `${u.identifier} marked inactive`)}>Make inactive</button>}
                    {u.status !== "blocked" && <button className="btn border border-amber-500 !py-1 text-amber-700 hover:bg-amber-50" onClick={() => setStatus(u, "blocked", `${u.identifier} blocked`)}>Block</button>}
                    <button className="btn-danger !py-1" onClick={() => remove(u)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={5} className="p-6 text-center text-gray-500">No users yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={pi.page} totalPages={pi.totalPages} total={pi.total} hrefFor={(p) => `/admin/users${p > 1 ? `?page=${p}` : ""}`} />
    </div>
  );
}
