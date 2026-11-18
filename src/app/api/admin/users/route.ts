import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await db();
  const r = await c.execute("SELECT id, name, email, phone, status, role, created_at FROM users ORDER BY id DESC");
  return NextResponse.json({ users: r.rows });
}
