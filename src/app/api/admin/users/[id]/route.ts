import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { parseId, validateStatus } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Returns an error response if the target is missing or is an admin account (admins can't be blocked or deleted here). */
async function guard(id: number) {
  const c = await db();
  const row = (await c.execute({ sql: "SELECT role FROM users WHERE id = ?", args: [id] })).rows[0];
  if (!row) return bad("User not found", 404);
  if (row.role !== "user") return bad("Admin accounts are managed under Admins", 403);
  return null;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid user id");
  const b = await readJson(req);
  if (!b || !validateStatus(b.status, ["active", "inactive", "blocked"])) return bad("Invalid status");
  const g = await guard(id);
  if (g) return g;
  const c = await db();
  if (me.role === "subadmin") {
    // A sub admin may only deactivate an active customer: no activating, blocking or un-blocking.
    if (b.status !== "inactive") return bad("Sub admins can only make users inactive", 403);
    const r = await c.execute({ sql: "UPDATE users SET status = 'inactive' WHERE id = ? AND role = 'user' AND status = 'active'", args: [id] });
    if (r.rowsAffected !== 1) return bad("Only active users can be made inactive", 409);
    return NextResponse.json({ ok: true });
  }
  await c.execute({ sql: "UPDATE users SET status = ? WHERE id = ? AND role = 'user'", args: [b.status as string, id] });
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
