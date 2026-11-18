import { NextResponse } from "next/server";
import { revalidateCatalog } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { cleanSettings, firstError, validateSettings } from "@/lib/validate";

export async function PUT(req: Request) {
  if (!(await getSuperAdmin())) return bad("Only the super admin can change shop settings", 403);
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
  revalidateCatalog(); // the home page reads these switches
  return NextResponse.json({ ok: true });
}
