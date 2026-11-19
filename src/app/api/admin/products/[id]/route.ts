import { NextResponse } from "next/server";
import { revalidateCatalog } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { canEditRow } from "@/lib/permissions";
import { bad, readJson } from "@/lib/http";
import { categoryExists, missingUploads } from "@/lib/productImages";
import { cleanProduct, firstError, parseId, validateProduct } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** 404 if missing, 403 if a sub admin tries to touch a product somebody else added. */
async function guard(me: { id: number; role: "admin" | "subadmin" }, id: number) {
  const c = await db();
  const row = (await c.execute({ sql: "SELECT created_by FROM products WHERE id = ?", args: [id] })).rows[0];
  if (!row) return bad("Product not found", 404);
  if (!canEditRow(me, row.created_by)) return bad("You can only change products you added", 403);
  return null;
}

export async function PUT(req: Request, { params }: Ctx) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid product id");
  const denied = await guard(me, id);
  if (denied) return denied;
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const p = cleanProduct(b);
  const err = firstError(validateProduct(p));
  if (err) return bad(err);
  const miss = await missingUploads(p.images);
  if (miss) return bad(miss);
  if (p.category_id !== null && !(await categoryExists(p.category_id))) return bad("That category no longer exists");
  const c = await db();
  // Orders may have taken stock while the form was open. The form sends the stock it started from (stock_base), so apply only the
  // admin's CHANGE (new − base) to the live number instead of overwriting it. Without stock_base, fall back to the absolute value.
  const base = typeof b.stock_base === "number" && Number.isInteger(b.stock_base) && b.stock_base >= 0 ? b.stock_base : null;
  const stockExpr = base === null ? "?" : "MAX(0, stock + ?)";
  const r = await c.execute({
    sql: `UPDATE products SET title=?, description=?, price=?, original_price=?, stock=${stockExpr}, sizes=?, image_url=?, images=?, category_id=?, status=? WHERE id=?`,
    args: [p.title, p.description, p.price, p.original_price, base === null ? p.stock : p.stock - base, p.sizes, p.images[0] || "", JSON.stringify(p.images), p.category_id, p.status, id],
  });
  if (!r.rowsAffected) return bad("Product not found", 404);
  revalidateCatalog();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid product id");
  const denied = await guard(me, id);
  if (denied) return denied;
  const c = await db();
  await c.execute({ sql: "DELETE FROM wishlist WHERE product_id = ?", args: [id] });
  await c.execute({ sql: "UPDATE order_items SET product_id = NULL WHERE product_id = ?", args: [id] }); // past orders keep title/price/photo
  const r = await c.execute({ sql: "DELETE FROM products WHERE id = ?", args: [id] });
  if (!r.rowsAffected) return bad("Product not found", 404);
  revalidateCatalog();
  return NextResponse.json({ ok: true });
}
