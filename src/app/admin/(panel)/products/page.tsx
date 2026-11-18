import { db } from "@/lib/db";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import type { Category, Product } from "@/lib/types";
import ProductManager from "./ProductManager";

export const dynamic = "force-dynamic";

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const c = await db();
  const total = Number((await c.execute("SELECT COUNT(*) AS n FROM products")).rows[0].n);
  const pi = pageInfo(total, parsePage((await searchParams).page));
  const rows = (await c.execute({ sql: `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.id DESC LIMIT ${PAGE_SIZE} OFFSET ?`, args: [pi.offset] })).rows as unknown as Product[];
  const cats = (await c.execute("SELECT id, name FROM categories ORDER BY name")).rows as unknown as Category[];
  return <ProductManager products={JSON.parse(JSON.stringify(rows))} categories={JSON.parse(JSON.stringify(cats))} pi={pi} />;
}
