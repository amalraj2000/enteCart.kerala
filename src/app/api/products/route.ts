import { NextResponse } from "next/server";
import { CATEGORY_JOIN, VISIBLE } from "@/lib/visibility";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const c = await db();
  const r = await c.execute(`SELECT p.* FROM products p ${CATEGORY_JOIN} WHERE ${VISIBLE} ORDER BY p.id DESC`);
  return NextResponse.json({ products: r.rows });
}
