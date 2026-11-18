import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { cleanStaff, firstError, validateStaff } from "@/lib/validate";

/** Create a sub admin. Super admin only. The role is fixed to "subadmin" — it is never read from the request. */
export async function POST(req: Request) {
  const me = await getSuperAdmin();
  if (!me) return bad("Only the super admin can manage admins", 403);
  if (!(await rateLimit(`create-staff:${me.id}`, 20, 3600))) return bad("Too many accounts created. Try again later.", 429);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const v = cleanStaff(b);
  const err = firstError(validateStaff(v));
  if (err) return bad(err);

  const c = await db();
  if ((await c.execute({ sql: "SELECT id FROM users WHERE email = ? OR phone = ?", args: [v.identifier, v.identifier] })).rows.length)
    return bad("An account with this email or phone already exists", 409);
  const isPhone = /^\d{10}$/.test(v.identifier);
  const r = await c.execute({
    sql: "INSERT INTO users (name, vendor_name, email, phone, password, role, status) VALUES (?, ?, ?, ?, ?, 'subadmin', 'active')",
    args: [v.name, v.vendor_name, isPhone ? null : v.identifier, isPhone ? v.identifier : null, await bcrypt.hash(v.password, 10)],
  });
  return NextResponse.json({ id: Number(r.lastInsertRowid) });
}
