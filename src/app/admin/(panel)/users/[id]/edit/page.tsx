import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { customerNameSql } from "@/lib/userName";
import EditUserForm from "./EditUserForm";

export const dynamic = "force-dynamic";

export default async function EditUser({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin(); // the layout already guarantees staff
  const c = await db();
  const u = (await c.execute({ sql: `SELECT u.id, ${customerNameSql("u")} AS name, u.email, u.phone, u.status, u.role, u.created_at FROM users u WHERE u.id = ?`, args: [Number((await params).id) || 0] })).rows[0];
  if (!u || u.role !== "user") notFound(); // staff accounts are edited under Admins
  return (
    <div className="space-y-4">
      <Link href="/admin/users" className="text-sm font-medium text-brand-700 hover:underline">← Back to users</Link>
      <EditUserForm
        user={{ id: Number(u.id), name: String(u.name || ""), email: u.email ? String(u.email) : "", phone: u.phone ? String(u.phone) : "", status: String(u.status), created_at: String(u.created_at) }}
        owner={me.role === "admin"} />
    </div>
  );
}
