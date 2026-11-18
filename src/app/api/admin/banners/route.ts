import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { missingUploads } from "@/lib/productImages";
import { cleanBanner, firstError, validateBanner } from "@/lib/validate";

export async function POST(req: Request) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const c = await db();
  const next = Number((await c.execute("SELECT COALESCE(MAX(position), 0) + 1 AS n FROM banners")).rows[0].n);
  const v = cleanBanner({ ...b, position: b.position ?? next });
  const err = firstError(validateBanner(v));
  if (err) return bad(err);
  if (await missingUploads(v.image ? [v.image] : [])) return bad("The uploaded banner image is missing — please upload it again");
  if ((Number((await c.execute("SELECT COUNT(*) AS n FROM banners")).rows[0].n)) >= 10) return bad("You can have at most 10 banners");
  const r = await c.execute({ sql: "INSERT INTO banners (title, subtitle, button_text, link, image, position, active, created_by) VALUES (?,?,?,?,?,?,?,?)", args: [v.title, v.subtitle, v.button_text, v.link, v.image, v.position, v.active, me.id] });
  return NextResponse.json({ id: Number(r.lastInsertRowid) });
}
