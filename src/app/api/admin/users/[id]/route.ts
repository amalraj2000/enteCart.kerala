import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { parseId, validateStatus } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Returns an error response if the target is missing or is an admin account (admins can't be blocked or deleted here). */
async function guard(id: number) {
  const c = await db();
  const row = (await c.execute({ sql: "SELECT role FROM users WHERE id = ?", args: [id] })).rows[0];
  if (!row) return bad("User not found", 404);
  if (row.role === "admin") return bad("The admin account can't be changed here", 403);
  return null;
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid user id");
  const b = await readJson(req);
  if (!b || !validateStatus(b.status, ["active", "inactive", "blocked"])) return bad("Invalid status");
  const g = await guard(id);
  if (g) return g;
  const c = await db();
  await c.execute({ sql: "UPDATE users SET status = ? WHERE id = ? AND role = 'user'", args: [b.status as string, id] });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid user id");
  const g = await guard(id);
  if (g) return g;
  const c = await db();
  await c.batch(
    [
      { sql: "UPDATE orders SET user_id = NULL, address_id = NULL WHERE user_id = ?", args: [id] }, // orders stay for the shop's records
      { sql: "UPDATE users SET address_id = NULL WHERE id = ?", args: [id] },
      { sql: "DELETE FROM addresses WHERE user_id = ?", args: [id] },
      { sql: "DELETE FROM users WHERE id = ? AND role = 'user'", args: [id] },
    ],
    "write"
  );
  return NextResponse.json({ ok: true });
}
