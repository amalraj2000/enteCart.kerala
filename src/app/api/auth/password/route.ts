import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { firstError, validatePasswordChange } from "@/lib/validate";

export async function PUT(req: Request) {
  const u = await getUser();
  if (!u) return bad("Login required", 401);
  if (!(await rateLimit(`pw:${u.id}`, 5, 600))) return bad("Too many attempts. Try again in a few minutes.", 429);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const err = firstError(validatePasswordChange(b));
  if (err) return bad(err);

  const c = await db();
  const row = (await c.execute({ sql: "SELECT password FROM users WHERE id = ?", args: [u.id] })).rows[0];
  if (!row || !(await bcrypt.compare(b.currentPassword as string, String(row.password)))) return bad("Current password is incorrect", 403);
  await c.execute({ sql: "UPDATE users SET password = ? WHERE id = ?", args: [await bcrypt.hash(b.newPassword as string, 10), u.id] });
  return NextResponse.json({ ok: true });
}
