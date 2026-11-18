import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await db();
  const n = async (t: string) => Number((await c.execute(`SELECT COUNT(*) AS n FROM ${t}`)).rows[0].n);
  return NextResponse.json({ users: await n("users"), products: await n("products"), orders: await n("orders") });
}
