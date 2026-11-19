import { NextResponse } from "next/server";
import { CATEGORY_JOIN, VISIBLE } from "@/lib/visibility";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const c = await db();
  const r = await c.execute(`SELECT p.id, p.title, p.description, p.price, p.original_price, p.stock, p.sizes, p.image_url, p.images, p.category_id, p.created_at FROM products p ${CATEGORY_JOIN} WHERE ${VISIBLE} ORDER BY p.id DESC`);
  return NextResponse.json({ products: r.rows });
}
