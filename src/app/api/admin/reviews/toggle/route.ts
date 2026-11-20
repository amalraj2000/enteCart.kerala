import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { REVIEWS_KEY } from "@/lib/reviews";

/** Super admin only: turn product reviews on or off for the whole shop. Body: { enabled: boolean }. */
export async function PUT(req: Request) {
  if (!(await getSuperAdmin())) return bad("Only the super admin can change this setting", 403);
  const b = await readJson(req);
  if (!b || typeof b.enabled !== "boolean") return bad("Invalid request");
  const c = await db();
  await c.execute({ sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [REVIEWS_KEY, b.enabled ? "1" : "0"] });
  return NextResponse.json({ ok: true, enabled: b.enabled });
}
