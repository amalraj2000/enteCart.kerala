import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSuperAdmin, pwTag, setSession } from "@/lib/session";
import { bad } from "@/lib/http";
import { parseId } from "@/lib/validate";
import { rateLimit } from "@/lib/rateLimit";

/** Super admin only: open the admin panel as one of their ACTIVE sub admins. The session remembers who started it (see getAdmin). */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSuperAdmin();
  if (!me) return bad("Only the super admin can do this", 403);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid admin id");
  if (!(await rateLimit(`impersonate:${me.id}`, 30, 600))) return bad("Too many attempts. Try again in a few minutes.", 429);
  const c = await db();
  const t = (await c.execute({ sql: "SELECT id, password FROM users WHERE id = ? AND role = 'subadmin' AND status = 'active'", args: [id] })).rows[0];
  if (!t) return bad("Only an active sub admin can be opened this way", 404);
  const o = (await c.execute({ sql: "SELECT password FROM users WHERE id = ?", args: [me.id] })).rows[0];
  await setSession("admin", { uid: Number(t.id), ph: pwTag(String(t.password)), imp: me.id, iph: pwTag(String(o.password)) });
  return NextResponse.json({ ok: true });
}
