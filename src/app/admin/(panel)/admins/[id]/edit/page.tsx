import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/session";
import EditAdminForm from "./EditAdminForm";

export const dynamic = "force-dynamic";

/** Super admin only. Only sub admin accounts are edited here — the owner account is managed from its own Account page. */
export default async function EditAdmin({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSuperAdmin())) redirect("/admin");
  const c = await db();
  const a = (await c.execute({ sql: "SELECT id, name, vendor_name, email, phone, role, status, created_at FROM users WHERE id = ?", args: [Number((await params).id) || 0] })).rows[0];
  if (!a || a.role !== "subadmin") notFound();
  return (
    <div className="space-y-4">
      <Link href="/admin/admins" className="text-sm font-medium text-brand-700 hover:underline">← Back to admins</Link>
      <EditAdminForm admin={{ id: Number(a.id), name: String(a.name || ""), vendor_name: String(a.vendor_name || ""), email: a.email ? String(a.email) : "", phone: a.phone ? String(a.phone) : "", status: String(a.status), created_at: String(a.created_at) }} />
    </div>
  );
}
