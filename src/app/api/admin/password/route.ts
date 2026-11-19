import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getAdmin, pwTag, setSession } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { STAFF_PASSWORD_MIN, firstError, validatePasswordChange } from "@/lib/validate";

export async function PUT(req: Request) {
  const a = await getAdmin();
  if (!a) return bad("Unauthorized", 401);
  if (!(await rateLimit(`admin-pw:${a.id}`, 5, 600))) return bad("Too many attempts. Try again in a few minutes.", 429);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const err = firstError(validatePasswordChange(b, STAFF_PASSWORD_MIN));
  if (err) return bad(err);
  const c = await db();
  const row = (await c.execute({ sql: "SELECT password FROM users WHERE id = ?", args: [a.id] })).rows[0];
  if (!row || !(await bcrypt.compare(b.currentPassword as string, String(row.password)))) return bad("Current password is incorrect", 403);
  const hash = await bcrypt.hash(b.newPassword as string, 10);
  await c.execute({ sql: "UPDATE users SET password = ? WHERE id = ?", args: [hash, a.id] });
  await setSession("admin", { uid: a.id, ph: pwTag(hash) }); // keep THIS session alive; every other session of this account ends
  return NextResponse.json({ ok: true });
}
