import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { cleanProfile, firstError, validateProfile } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  const a = await getAdmin();
  if (!a) return bad("Unauthorized", 401);
  const c = await db();
  const row = (await c.execute({ sql: "SELECT name, vendor_name, avatar FROM users WHERE id = ?", args: [a.id] })).rows[0];
  return NextResponse.json({ role: a.role, vendor_name: String(row?.vendor_name || ""), username: a.identifier, name: String(row?.name || ""), avatar: String(row?.avatar || "") });
}

export async function PUT(req: Request) {
  const a = await getAdmin();
  if (!a) return bad("Unauthorized", 401);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const p = cleanProfile(b);
  const err = firstError(validateProfile(p));
  if (err) return bad(err);
  const c = await db();
  await c.execute({ sql: "UPDATE users SET name = ?, avatar = ? WHERE id = ?", args: [p.name, p.avatar, a.id] });
  return NextResponse.json({ ok: true });
}
