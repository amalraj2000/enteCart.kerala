import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { canEditRow } from "@/lib/permissions";
import { bad, readJson } from "@/lib/http";
import { missingUploads } from "@/lib/productImages";
import { cleanBanner, firstError, parseId, validateBanner } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

async function guard(me: { id: number; role: "admin" | "subadmin" }, id: number) {
  const c = await db();
  const row = (await c.execute({ sql: "SELECT created_by FROM banners WHERE id = ?", args: [id] })).rows[0];
  if (!row) return bad("Banner not found", 404);
  if (!canEditRow(me, row.created_by)) return bad("You can only change banners you created", 403);
  return null;
}

export async function PUT(req: Request, { params }: Ctx) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid banner id");
  const denied = await guard(me, id);
  if (denied) return denied;
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
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid banner id");
  const denied = await guard(me, id);
  if (denied) return denied;
  const c = await db();
  const r = await c.execute({ sql: "DELETE FROM banners WHERE id = ?", args: [id] });
  if (!r.rowsAffected) return bad("Banner not found", 404);
  return NextResponse.json({ ok: true });
}
