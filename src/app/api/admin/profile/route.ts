import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { currentAdminUsername, ensureAdminRow } from "@/lib/adminAuth";
import { bad, readJson } from "@/lib/http";
import { cleanProfile, firstError, validateProfile } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  const c = await db();
  const row = (await c.execute("SELECT first_name, last_name, avatar FROM admin WHERE id = 1")).rows[0];
  return NextResponse.json({
    username: await currentAdminUsername(),
    first_name: String(row?.first_name || ""),
    last_name: String(row?.last_name || ""),
    avatar: String(row?.avatar || ""),
  });
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const p = cleanProfile(b);
  const err = firstError(validateProfile(p));
  if (err) return bad(err);
  const c = await ensureAdminRow();
  await c.execute({ sql: "UPDATE admin SET first_name = ?, last_name = ?, avatar = ? WHERE id = 1", args: [p.first_name, p.last_name, p.avatar] });
  return NextResponse.json({ ok: true });
}
