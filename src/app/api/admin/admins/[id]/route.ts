import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { cleanAccount, firstError, parseId, validateAccount, validatePassword, validateStatus } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Loads the target and makes sure it's a sub admin — the owner account can't be touched from here. */
async function target(id: number) {
  const c = await db();
  const row = (await c.execute({ sql: "SELECT id, role FROM users WHERE id = ?", args: [id] })).rows[0];
  if (!row) return { err: bad("Admin not found", 404) };
  if (row.role !== "subadmin") return { err: bad("Only sub admin accounts can be changed here", 403) };
  return { c };
}

/** PATCH any of { name, email, phone, vendor_name, status, password } — the edit page sends them together. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await getSuperAdmin())) return bad("Only the super admin can manage admins", 403);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid id");
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const t = await target(id);
  if (t.err) return t.err;
  const c = t.c!;
  const sets: string[] = [], args: (string | number | null)[] = [];

  if ("name" in b || "email" in b || "phone" in b || "vendor_name" in b) {
    const v = cleanAccount(b), err = firstError(validateAccount(v, { nameRequired: true, vendor: true }));
    if (err) return bad(err);
    if (v.email && (await c.execute({ sql: "SELECT 1 FROM users WHERE email = ? AND id != ?", args: [v.email, id] })).rows.length) return bad("That email is already used by another account", 409);
    if (v.phone && (await c.execute({ sql: "SELECT 1 FROM users WHERE phone = ? AND id != ?", args: [v.phone, id] })).rows.length) return bad("That phone number is already used by another account", 409);
    sets.push("name = ?", "vendor_name = ?", "email = ?", "phone = ?"); args.push(v.name, v.vendor_name, v.email || null, v.phone || null);
  }
  if ("status" in b) {
    if (!validateStatus(b.status, ["active", "inactive", "blocked"])) return bad("Invalid status");
    sets.push("status = ?"); args.push(b.status as string);
  }
  if ("password" in b && b.password !== "") { // blank = keep the current password
    const e = validatePassword(b.password, "Password");
    if (e) return bad(e);
    sets.push("password = ?"); args.push(await bcrypt.hash(b.password as string, 10)); // also ends their current sessions
  }
  if (!sets.length) return bad("Nothing to update");
  try {
    await c.execute({ sql: `UPDATE users SET ${sets.join(", ")} WHERE id = ? AND role = 'subadmin'`, args: [...args, id] });
  } catch { return bad("That email or phone number is already used by another account", 409); }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  if (!(await getSuperAdmin())) return bad("Only the super admin can manage admins", 403);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid id");
  const t = await target(id);
  if (t.err) return t.err;
  await t.c!.execute({ sql: "DELETE FROM users WHERE id = ? AND role = 'subadmin'", args: [id] });
  return NextResponse.json({ ok: true });
}
