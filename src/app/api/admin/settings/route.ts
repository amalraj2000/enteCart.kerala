import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { cleanSettings, firstError, validateSettings } from "@/lib/validate";

export async function PUT(req: Request) {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const v = cleanSettings(b);
  const err = firstError(validateSettings(v));
  if (err) return bad(err);
  const c = await db();
  await c.batch(
    Object.entries(v).map(([key, value]) => ({ sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [key, value] })),
    "write"
  );
  return NextResponse.json({ ok: true });
}
