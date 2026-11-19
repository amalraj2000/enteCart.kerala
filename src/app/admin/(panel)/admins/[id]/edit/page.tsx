import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";
import EditAdminForm from "./EditAdminForm";

export const dynamic = "force-dynamic";

/** Super admin only. Edits a sub admin or another super admin — never your own account (that is the Account page). */
export default async function EditAdmin({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireSuperAdmin();
  const c = await db();
  const a = (await c.execute({ sql: "SELECT id, name, vendor_name, email, phone, role, status, created_at FROM users WHERE id = ?", args: [Number((await params).id) || 0] })).rows[0];
  if (!a || (a.role !== "subadmin" && a.role !== "admin")) notFound();
  if (Number(a.id) === me.id) redirect("/admin/admins");
  return (
    <div className="space-y-4">
      <Link href="/admin/admins" className="text-sm font-medium text-brand-700 hover:underline">← Back to admins</Link>
      <EditAdminForm admin={{ id: Number(a.id), role: String(a.role), name: String(a.name || ""), vendor_name: String(a.vendor_name || ""), email: a.email ? String(a.email) : "", phone: a.phone ? String(a.phone) : "", status: String(a.status), created_at: String(a.created_at) }} />
    </div>
  );
}
