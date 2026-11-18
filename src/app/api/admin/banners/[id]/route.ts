import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { missingUploads } from "@/lib/productImages";
import { cleanBanner, firstError, parseId, validateBanner } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid banner id");
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const v = cleanBanner(b);
  const err = firstError(validateBanner(v));
  if (err) return bad(err);
  if (await missingUploads(v.image ? [v.image] : [])) return bad("The uploaded banner image is missing — please upload it again");
  const c = await db();
  const r = await c.execute({ sql: "UPDATE banners SET title=?, subtitle=?, button_text=?, link=?, image=?, position=?, active=? WHERE id=?", args: [v.title, v.subtitle, v.button_text, v.link, v.image, v.position, v.active, id] });
  if (!r.rowsAffected) return bad("Banner not found", 404);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid banner id");
  const c = await db();
  const r = await c.execute({ sql: "DELETE FROM banners WHERE id = ?", args: [id] });
  if (!r.rowsAffected) return bad("Banner not found", 404);
  return NextResponse.json({ ok: true });
}
