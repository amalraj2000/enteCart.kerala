import { db } from "@/lib/db";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import CategoriesManager from "./CategoriesManager";

export const dynamic = "force-dynamic";

export default async function AdminCategories({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const c = await db();
  const total = Number((await c.execute("SELECT COUNT(*) AS n FROM categories")).rows[0].n);
  const pi = pageInfo(total, parsePage((await searchParams).page));
  const rows = (await c.execute({ sql: `SELECT c.id, c.name, COUNT(p.id) AS count FROM categories c LEFT JOIN products p ON p.category_id = c.id GROUP BY c.id ORDER BY c.name LIMIT ${PAGE_SIZE} OFFSET ?`, args: [pi.offset] })).rows;
  return <CategoriesManager categories={JSON.parse(JSON.stringify(rows))} pi={pi} />;
}
