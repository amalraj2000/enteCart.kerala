import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { canEditRow } from "@/lib/permissions";
import { addedBySql } from "@/lib/staffLabel";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import CategoriesManager from "./CategoriesManager";

export const dynamic = "force-dynamic";

export default async function AdminCategories({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const me = (await getAdmin())!;
  const c = await db();
  const total = Number((await c.execute("SELECT COUNT(*) AS n FROM categories")).rows[0].n);
  const pi = pageInfo(total, parsePage((await searchParams).page));
  const rows = (await c.execute({
    sql: `SELECT c.id, c.name, c.created_by, COUNT(p.id) AS count,
                 ${addedBySql("c.created_by", "cu")} AS added_by_name
          FROM categories c LEFT JOIN products p ON p.category_id = c.id LEFT JOIN users cu ON cu.id = c.created_by
          GROUP BY c.id ORDER BY c.name LIMIT ${PAGE_SIZE} OFFSET ?`,
    args: [pi.offset],
  })).rows;
  const withPerm = rows.map((r) => ({ ...JSON.parse(JSON.stringify(r)), editable: canEditRow(me, r.created_by) })); // sub admins change only their own
  return <CategoriesManager categories={withPerm} pi={pi} />;
}
