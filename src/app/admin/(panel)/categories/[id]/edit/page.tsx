import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { canEditRow } from "@/lib/permissions";
import EditCategoryForm from "./EditCategoryForm";

export const dynamic = "force-dynamic";

export default async function EditCategory({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const c = await db();
  const r = (await c.execute({ sql: "SELECT c.id, c.name, c.status, c.created_by, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS count FROM categories c WHERE c.id = ?", args: [Number((await params).id) || 0] })).rows[0];
  if (!r) notFound();
  if (!canEditRow(me, r.created_by)) redirect("/admin/categories"); // sub admins edit only their own
  return (
    <div className="space-y-4">
      <Link href="/admin/categories" className="text-sm font-medium text-brand-700 hover:underline">← Back to categories</Link>
      <EditCategoryForm category={{ id: Number(r.id), name: String(r.name), status: String(r.status || "active"), count: Number(r.count) }} />
    </div>
  );
}
