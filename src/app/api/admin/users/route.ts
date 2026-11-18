import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { customerNameSql } from "@/lib/userName";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await db();
  const r = await c.execute(`SELECT u.id, ${customerNameSql("u")} AS name, u.email, u.phone, u.status, u.role, u.created_at FROM users u WHERE u.role = 'user' ORDER BY u.id DESC`);
  return NextResponse.json({ users: r.rows });
}
