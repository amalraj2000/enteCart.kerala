import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { listNotifications, markNotifications } from "@/lib/notifications";
export const dynamic = "force-dynamic";

/** Staff notifications (new orders / reviews): super admin = everything, sub admin = their own products. Same shape as the customer API. */
export async function GET() {
  const me = await getAdmin();
  if (!me) return NextResponse.json({ unread: 0, items: [] });
  return NextResponse.json(await listNotifications(await db(), me.id));
}

export async function PUT(req: Request) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const b = await readJson(req);
  if (!b || !(await markNotifications(await db(), me.id, b))) return bad("Invalid request");
  return NextResponse.json({ ok: true });
}
