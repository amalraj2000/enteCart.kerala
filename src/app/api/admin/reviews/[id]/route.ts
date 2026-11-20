import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { canEditRow } from "@/lib/permissions";
import { bad, readJson } from "@/lib/http";
import { parseId, validateStatus, cleanReview, firstError, validateReview } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** The super admin moderates every review; a sub admin only reviews of products they added themselves. */
async function guard(me: { id: number; role: "admin" | "subadmin" }, id: number) {
  const c = await db();
  const row = (await c.execute({ sql: "SELECT p.created_by FROM reviews r LEFT JOIN products p ON p.id = r.product_id WHERE r.id = ?", args: [id] })).rows[0];
  if (!row) return bad("Review not found", 404);
  if (!canEditRow(me, row.created_by)) return bad("You can only moderate reviews of products you added", 403);
  return null;
}

/** PATCH { status?: "approved" | "rejected" | "pending", active?: boolean } — approval and visibility are separate switches. */
export async function PATCH(req: Request, { params }: Ctx) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid review id");
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const sets: string[] = [], args: (string | number)[] = [];
  if ("status" in b) { if (!validateStatus(b.status, ["pending", "approved", "rejected"])) return bad("Invalid status"); sets.push("status = ?"); args.push(b.status as string); }
  if ("active" in b) { if (typeof b.active !== "boolean") return bad("Invalid request"); sets.push("active = ?"); args.push(b.active ? 1 : 0); }
  if (!sets.length) return bad("Nothing to update");
  const denied = await guard(me, id);
  if (denied) return denied;
  const c = await db();
  await c.execute({ sql: `UPDATE reviews SET ${sets.join(", ")} WHERE id = ?`, args: [...args, id] });
  return NextResponse.json({ ok: true });
}

/** PUT { rating, comment, images } — staff corrects a review (e.g. removes a rude word or a photo). Photos can only be removed, not added. The status is left as it is. */
export async function PUT(req: Request, { params }: Ctx) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid review id");
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const r = cleanReview(b);
  const err = firstError(validateReview(r));
  if (err) return bad(err);
  const denied = await guard(me, id);
  if (denied) return denied;
  const c = await db();
  const have = (await c.execute({ sql: "SELECT id FROM review_images WHERE review_id = ?", args: [id] })).rows.map((x) => Number(x.id));
  const keep = r.images.map((u) => Number(/^\/api\/review-images\/(\d+)$/.exec(u)![1]));
  if (keep.some((k) => !have.includes(k))) return bad("A photo does not belong to this review");
  await c.batch([
    { sql: "UPDATE reviews SET rating = ?, comment = ?, updated_at = datetime('now') WHERE id = ?", args: [r.rating, r.comment, id] },
    { sql: `DELETE FROM review_images WHERE review_id = ? ${keep.length ? `AND id NOT IN (${keep.map(() => "?").join(",")})` : ""}`, args: [id, ...keep] },
  ], "write");
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid review id");
  const denied = await guard(me, id);
  if (denied) return denied;
  const c = await db();
  await c.batch([{ sql: "DELETE FROM review_images WHERE review_id = ?", args: [id] }, { sql: "DELETE FROM reviews WHERE id = ?", args: [id] }], "write");
  return NextResponse.json({ ok: true });
}
