import { NextResponse } from "next/server";
import { revalidateCatalog } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { categoryExists, missingUploads } from "@/lib/productImages";
import { cleanProduct, firstError, validateProduct } from "@/lib/validate";

export async function POST(req: Request) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const p = cleanProduct(b);
  const err = firstError(validateProduct(p));
  if (err) return bad(err);
  const miss = await missingUploads(p.images);
  if (miss) return bad(miss);
  if (p.category_id !== null && !(await categoryExists(p.category_id))) return bad("That category no longer exists");
  const c = await db();
  const r = await c.execute({ sql: "INSERT INTO products (title, description, price, original_price, stock, sizes, image_url, images, category_id, status, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))", args: [p.title, p.description, p.price, p.original_price, p.stock, p.sizes, p.images[0] || "", JSON.stringify(p.images), p.category_id, p.status, me.id] });
  revalidateCatalog();
  return NextResponse.json({ id: Number(r.lastInsertRowid) });
}
