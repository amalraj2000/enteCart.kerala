import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const c = await db();
  const r = await c.execute("SELECT c.id, c.name, COUNT(p.id) AS count FROM categories c LEFT JOIN products p ON p.category_id = c.id GROUP BY c.id ORDER BY c.name");
  return NextResponse.json({ categories: r.rows });
}
