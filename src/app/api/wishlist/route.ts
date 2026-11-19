import { NextResponse } from "next/server";
import { CATEGORY_JOIN, VISIBLE } from "@/lib/visibility";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
export const dynamic = "force-dynamic";

/** GET → { ids }  (or ?full=1 → { products } for the wishlist page) */
export async function GET(req: Request) {
  const u = await getUser();
  if (!u) return NextResponse.json({ ids: [], products: [] });
  const c = await db();
  if (new URL(req.url).searchParams.get("full") === "1") {
    const r = await c.execute({ sql: `SELECT p.id, p.public_id, p.title, p.description, p.price, p.original_price, p.stock, p.sizes, p.image_url, p.images, p.category_id, p.created_at FROM wishlist w JOIN products p ON p.id = w.product_id ${CATEGORY_JOIN} WHERE w.user_id = ? AND ${VISIBLE} ORDER BY w.created_at DESC`, args: [u.id] });
    return NextResponse.json({ products: r.rows });
  }
  const r = await c.execute({ sql: "SELECT product_id FROM wishlist WHERE user_id = ?", args: [u.id] });
  return NextResponse.json({ ids: r.rows.map((x) => Number(x.product_id)) });
}

/** PUT { productId, on } adds or removes a product from the customer's wishlist. */
export async function PUT(req: Request) {
  const u = await getUser();
  if (!u) return bad("Please log in to use your wishlist", 401);
  const b = await readJson(req);
  const id = typeof b?.productId === "number" && Number.isInteger(b.productId) && b.productId > 0 ? b.productId : null;
  if (!id || typeof b?.on !== "boolean") return bad("Invalid request");
  const c = await db();
  if (b.on) {
    if (!(await c.execute({ sql: `SELECT 1 FROM products p ${CATEGORY_JOIN} WHERE p.id = ? AND ${VISIBLE}`, args: [id] })).rows.length) return bad("Product not found", 404);
    if (Number((await c.execute({ sql: "SELECT COUNT(*) AS n FROM wishlist WHERE user_id = ?", args: [u.id] })).rows[0].n) >= 200) return bad("Your wishlist is full (200 items)");
    await c.execute({ sql: "INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)", args: [u.id, id] });
  } else {
    await c.execute({ sql: "DELETE FROM wishlist WHERE user_id = ? AND product_id = ?", args: [u.id, id] });
  }
  return NextResponse.json({ ok: true });
}
