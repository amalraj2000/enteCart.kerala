import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { confirmOwnPassword } from "@/lib/confirmPassword";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { cleanAccount, firstError, parseId, validateAccount, validatePassword, validateStatus } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Loads the target: a sub admin or another super admin. You can never act on your own account here (use the Account page). */
async function target(id: number, meId: number) {
  const c = await db();
  const row = (await c.execute({ sql: "SELECT id, role FROM users WHERE id = ?", args: [id] })).rows[0];
  if (!row) return { err: bad("Admin not found", 404) };
  if (row.role !== "subadmin" && row.role !== "admin") return { err: bad("Only admin accounts can be changed here", 403) };
  if (id === meId) return { err: bad("Use your Account page to change your own details.", 403) };
  return { c, role: String(row.role) };
}

/** PATCH any of { name, email, phone, vendor_name, status, password, role (+ confirm_password for a role change) } — the edit page sends them together. */
export async function PATCH(req: Request, { params }: Ctx) {
  const me = await getSuperAdmin();
  if (!me) return bad("Only the super admin can manage admins", 403);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid id");
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const t = await target(id, me.id);
  if (t.err) return t.err;
  const c = t.c!;
  const sets: string[] = [], args: (string | number | null)[] = [];

  // Role change (promote a sub admin / demote a super admin). Needs the acting admin's own password.
  const newRole = "role" in b ? (b.role === "admin" ? "admin" : b.role === "subadmin" ? "subadmin" : null) : t.role;
  if (!newRole) return bad("Invalid role");
  if (newRole !== t.role) {
    if (!(await confirmOwnPassword(c, me.id, b.confirm_password))) return bad("To change an admin's role, enter your own password to confirm.", 403);
    sets.push("role = ?"); args.push(newRole);
  }
  if ("name" in b || "email" in b || "phone" in b || "vendor_name" in b) {
    const v = cleanAccount(b), err = firstError(validateAccount(v, { nameRequired: true, vendor: newRole === "subadmin" }));
    if (err) return bad(err);
    if (v.email && (await c.execute({ sql: "SELECT 1 FROM users WHERE email = ? AND id != ?", args: [v.email, id] })).rows.length) return bad("That email is already used by another account", 409);
    if (v.phone && (await c.execute({ sql: "SELECT 1 FROM users WHERE phone = ? AND id != ?", args: [v.phone, id] })).rows.length) return bad("That phone number is already used by another account", 409);
    sets.push("name = ?", "vendor_name = ?", "email = ?", "phone = ?"); args.push(v.name, newRole === "admin" ? "" : v.vendor_name, v.email || null, v.phone || null);
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
    await c.execute({ sql: `UPDATE users SET ${sets.join(", ")} WHERE id = ? AND role IN ('subadmin', 'admin')`, args: [...args, id] });
  } catch { return bad("That email or phone number is already used by another account", 409); }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const me = await getSuperAdmin();
  if (!me) return bad("Only the super admin can manage admins", 403);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid id");
  const t = await target(id, me.id); // never yourself, so at least one super admin always remains
  if (t.err) return t.err;
  await t.c!.execute({ sql: "DELETE FROM users WHERE id = ? AND role IN ('subadmin', 'admin')", args: [id] });
  return NextResponse.json({ ok: true });
}
