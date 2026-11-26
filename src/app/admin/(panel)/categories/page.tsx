import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { canEditRow } from "@/lib/permissions";
import { addedBySql } from "@/lib/staffLabel";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import CategoriesManager from "./CategoriesManager";

export const dynamic = "force-dynamic";

export default async function AdminCategories({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const me = await requireAdmin();
  const c = await db();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const where = q ? "WHERE c.name LIKE ?" : "", qa = q ? [`%${q.replace(/[%_]/g, "")}%`] : [];
  const total = Number((await c.execute({ sql: `SELECT COUNT(*) AS n FROM categories c ${where}`, args: qa })).rows[0].n);
  const pi = pageInfo(total, parsePage(sp.page));
  const rows = (await c.execute({
    sql: `SELECT c.id, c.name, c.status, c.created_by, COUNT(p.id) AS count,
                 ${addedBySql("c.created_by", "cu")} AS added_by_name
          FROM categories c LEFT JOIN products p ON p.category_id = c.id LEFT JOIN users cu ON cu.id = c.created_by
          ${where} GROUP BY c.id ORDER BY c.name LIMIT ${PAGE_SIZE} OFFSET ?`,
    args: [...qa, pi.offset],
  })).rows;
  const withPerm = rows.map((r) => ({ ...JSON.parse(JSON.stringify(r)), editable: canEditRow(me, r.created_by) })); // sub admins change only their own
  return <CategoriesManager categories={withPerm} pi={pi} q={q} />;
}
