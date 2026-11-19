import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { cleanAccount, firstError, parseId, validateAccount, validateStatus } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Returns an error response if the target is missing or is an admin account (admins can't be blocked or deleted here). */
async function guard(id: number) {
  const c = await db();
  const row = (await c.execute({ sql: "SELECT role FROM users WHERE id = ?", args: [id] })).rows[0];
  if (!row) return bad("User not found", 404);
  if (row.role !== "user") return bad("Admin accounts are managed under Admins", 403);
  return null;
}

/** PATCH { status } (any staff, sub admins: only "inactive")  ·  PATCH { name, email, phone, status? } (super admin: edit the account). */
export async function PATCH(req: Request, { params }: Ctx) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid user id");
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const editsDetails = "name" in b || "email" in b || "phone" in b;
  if ("status" in b && !validateStatus(b.status, ["active", "inactive", "blocked"])) return bad("Invalid status");
  if (!editsDetails && !("status" in b)) return bad("Nothing to update");
  const g = await guard(id);
  if (g) return g;
  const c = await db();

  if (me.role === "subadmin") {
    // A sub admin may only deactivate an active customer: no editing, activating, blocking or un-blocking.
    if (editsDetails || b.status !== "inactive") return bad("Sub admins can only make users inactive", 403);
    const r = await c.execute({ sql: "UPDATE users SET status = 'inactive' WHERE id = ? AND role = 'user' AND status = 'active'", args: [id] });
    if (r.rowsAffected !== 1) return bad("Only active users can be made inactive", 409);
    return NextResponse.json({ ok: true });
  }

  const sets: string[] = [], args: (string | number | null)[] = [];
  if (editsDetails) {
    const v = cleanAccount(b), err = firstError(validateAccount(v, { nameRequired: false, vendor: false }));
    if (err) return bad(err);
    // email and phone are each the login for exactly one account
    if (v.email && (await c.execute({ sql: "SELECT 1 FROM users WHERE email = ? AND id != ?", args: [v.email, id] })).rows.length) return bad("That email is already used by another account", 409);
    if (v.phone && (await c.execute({ sql: "SELECT 1 FROM users WHERE phone = ? AND id != ?", args: [v.phone, id] })).rows.length) return bad("That phone number is already used by another account", 409);
    sets.push("name = ?", "email = ?", "phone = ?"); args.push(v.name, v.email || null, v.phone || null);
  }
  if ("status" in b) { sets.push("status = ?"); args.push(b.status as string); }
  try {
    await c.execute({ sql: `UPDATE users SET ${sets.join(", ")} WHERE id = ? AND role = 'user'`, args: [...args, id] });
  } catch { return bad("That email or phone number is already used by another account", 409); }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  if (me.role !== "admin") return bad("Only the super admin can delete users", 403);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid user id");
  const g = await guard(id);
  if (g) return g;
  const c = await db();
  await c.batch(
    [
      { sql: "UPDATE orders SET user_id = NULL, address_id = NULL WHERE user_id = ?", args: [id] }, // orders stay for the shop's records
      { sql: "UPDATE users SET address_id = NULL WHERE id = ?", args: [id] },
      { sql: "DELETE FROM wishlist WHERE user_id = ?", args: [id] },
      { sql: "DELETE FROM addresses WHERE user_id = ?", args: [id] },
      { sql: "DELETE FROM users WHERE id = ? AND role = 'user'", args: [id] },
    ],
    "write"
  );
  return NextResponse.json({ ok: true });
}
