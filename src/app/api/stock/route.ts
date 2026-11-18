import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bad } from "@/lib/http";
import { parseId } from "@/lib/validate";
export const dynamic = "force-dynamic";

/** GET /api/stock?ids=1,2,3 → { stock: { "1": 5, "2": 0 } } — live stock so carts never rely on a stale number. Public (stock is shown on product pages anyway). */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("ids") || "";
  const ids = [...new Set(raw.split(",").map((x) => parseId(x.trim())).filter((x): x is number => x !== null))];
  if (!ids.length) return bad("No product ids");
  if (ids.length > 50) return bad("Too many products");
  const c = await db();
  const r = await c.execute({ sql: `SELECT id, stock FROM products WHERE id IN (${ids.map(() => "?").join(",")})`, args: ids });
  const stock: Record<string, number> = Object.fromEntries(ids.map((i) => [String(i), 0])); // a deleted product counts as 0
  for (const row of r.rows) stock[String(row.id)] = Number(row.stock);
  return NextResponse.json({ stock });
}
