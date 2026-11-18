import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function GET() {
  const u = await getUser();
  if (!u) return NextResponse.json({ user: null });
  const c = await db();
  const r = (await c.execute({ sql: "SELECT first_name, last_name, avatar FROM users WHERE id = ?", args: [u.id] })).rows[0];
  return NextResponse.json({ user: { ...u, first_name: String(r?.first_name || ""), last_name: String(r?.last_name || ""), avatar: String(r?.avatar || "") } });
}
