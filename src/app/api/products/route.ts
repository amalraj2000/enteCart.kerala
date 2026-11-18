import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const c = await db();
  const r = await c.execute("SELECT * FROM products ORDER BY id DESC");
  return NextResponse.json({ products: r.rows });
}
