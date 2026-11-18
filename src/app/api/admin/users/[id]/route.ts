import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { parseId, validateStatus } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid user id");
  const b = await readJson(req);
  if (!b || !validateStatus(b.status, ["active", "inactive", "blocked"])) return bad("Invalid status");
  const c = await db();
  const r = await c.execute({ sql: "UPDATE users SET status = ? WHERE id = ?", args: [b.status as string, id] });
  if (!r.rowsAffected) return bad("User not found", 404);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid user id");
  const c = await db();
  const r = await c.execute({ sql: "DELETE FROM users WHERE id = ?", args: [id] });
  if (!r.rowsAffected) return bad("User not found", 404);
  return NextResponse.json({ ok: true });
}
