import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { canEditRow } from "@/lib/permissions";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import { parseId } from "@/lib/validate";
import { addedBySql, staffNameSql } from "@/lib/staffLabel";
import type { Category, Product } from "@/lib/types";
import ProductManager from "./ProductManager";

export const dynamic = "force-dynamic";

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ page?: string; by?: string; q?: string }> }) {
  const sp = await searchParams;
  const me = await requireAdmin(); // the layout already guarantees staff
  const c = await db();
  const staff = (await c.execute(`SELECT id, ${staffNameSql("users")} AS name FROM users WHERE role IN ('admin', 'subadmin') ORDER BY (role = 'admin') DESC, id`)).rows as unknown as { id: number; name: string }[];

  // "Added by" filter: all (default), me, or one specific admin
  const byId = sp.by === "me" ? me.id : parseId(sp.by);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const conds: string[] = [], args: (string | number)[] = [];
  if (byId) { conds.push("p.created_by = ?"); args.push(byId); }
  if (q) { conds.push("p.title LIKE ?"); args.push(`%${q.replace(/[%_]/g, "")}%`); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const total = Number((await c.execute({ sql: `SELECT COUNT(*) AS n FROM products p ${where}`, args })).rows[0].n);
  const pi = pageInfo(total, parsePage(sp.page));
  const rows = (await c.execute({
    sql: `SELECT p.*, c.name AS category_name,
                 ${addedBySql("p.created_by", "cu")} AS added_by_name
          FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN users cu ON cu.id = p.created_by
          ${where} ORDER BY p.id DESC LIMIT ${PAGE_SIZE} OFFSET ?`,
    args: [...args, pi.offset],
  })).rows as unknown as Product[];
  const cats = (await c.execute("SELECT id, name, status FROM categories ORDER BY name")).rows as unknown as Category[];
  const withPerm = rows.map((r) => ({ ...JSON.parse(JSON.stringify(r)), editable: canEditRow(me, r.created_by) })); // sub admins edit only what they added
  return <ProductManager products={withPerm} categories={JSON.parse(JSON.stringify(cats))} pi={pi} staff={JSON.parse(JSON.stringify(staff))} meId={me.id} by={byId ? String(byId) : "all"} q={q} />;
}
