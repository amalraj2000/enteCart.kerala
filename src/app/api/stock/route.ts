import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bad } from "@/lib/http";
import { CATEGORY_JOIN, VISIBLE } from "@/lib/visibility";
import { parseId } from "@/lib/validate";
export const dynamic = "force-dynamic";

/** GET /api/stock?ids=1,2,3 → { stock: { "1": 5, "2": 0 } } — live stock so carts never rely on a stale number. Public (stock is shown on product pages anyway). */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("ids") || "";
  const ids = [...new Set(raw.split(",").map((x) => parseId(x.trim())).filter((x): x is number => x !== null))];
  if (!ids.length) return bad("No product ids");
  if (ids.length > 50) return bad("Too many products");
  const c = await db();
  const r = await c.execute({ sql: `SELECT p.id, CASE WHEN ${VISIBLE} THEN p.stock ELSE 0 END AS stock FROM products p ${CATEGORY_JOIN} WHERE p.id IN (${ids.map(() => "?").join(",")})`, args: ids });
  const stock: Record<string, number> = Object.fromEntries(ids.map((i) => [String(i), 0])); // a deleted product counts as 0
  for (const row of r.rows) stock[String(row.id)] = Number(row.stock);
  // Shared by every visitor for a few seconds: a thousand people watching the same product cost one database read, not a thousand.
  // Display only — the order API always checks live stock.
  return NextResponse.json({ stock }, { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15" } });
}
