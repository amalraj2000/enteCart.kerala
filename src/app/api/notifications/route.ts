import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { listNotifications, markNotifications } from "@/lib/notifications";
export const dynamic = "force-dynamic";

/** The customer's own notifications: { unread, items } (newest 20). The header bell polls this. */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ unread: 0, items: [] });
  return NextResponse.json(await listNotifications(await db(), user.id));
}

/** PUT { id } marks one as read, PUT { all: true } marks every one as read. */
export async function PUT(req: Request) {
  const user = await getUser();
  if (!user) return bad("Login required", 401);
  const b = await readJson(req);
  if (!b || !(await markNotifications(await db(), user.id, b))) return bad("Invalid request");
  return NextResponse.json({ ok: true });
}
