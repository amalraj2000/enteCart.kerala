import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function GET() {
  const u = await getUser();
  if (!u) return NextResponse.json({ user: null });
  const c = await db();
  const r = (await c.execute({ sql: "SELECT name, email, phone, avatar FROM users WHERE id = ?", args: [u.id] })).rows[0];
  return NextResponse.json({ user: { ...u, name: String(r?.name || ""), email: r?.email ? String(r.email) : null, phone: r?.phone ? String(r.phone) : null, avatar: String(r?.avatar || "") } });
}
