import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
export const dynamic = "force-dynamic";

/** The customer's own notifications: { unread, items } (newest 20). Header bell polls this. */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ unread: 0, items: [] });
  const c = await db();
  const [unread, items] = await Promise.all([
    c.execute({ sql: "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0", args: [user.id] }),
    c.execute({ sql: "SELECT id, type, title, body, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 20", args: [user.id] }),
  ]);
  return NextResponse.json({
    unread: Number(unread.rows[0].n),
    items: items.rows.map((r) => ({ id: Number(r.id), type: String(r.type), title: String(r.title), body: String(r.body), link: String(r.link), read: Number(r.is_read) === 1, created_at: String(r.created_at) })),
  });
}

/** PUT { id } marks one as read, PUT { all: true } marks every one as read. Only ever touches the caller's own rows. */
export async function PUT(req: Request) {
  const user = await getUser();
  if (!user) return bad("Login required", 401);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const c = await db();
  if (b.all === true) await c.execute({ sql: "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", args: [user.id] });
  else if (typeof b.id === "number" && Number.isInteger(b.id) && b.id > 0) await c.execute({ sql: "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", args: [b.id, user.id] });
  else return bad("Invalid request");
  return NextResponse.json({ ok: true });
}
