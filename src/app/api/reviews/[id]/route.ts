import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { parseId, cleanReview, firstError, validateReview } from "@/lib/validate";
import { rateLimit } from "@/lib/rateLimit";
import { LOCKED_MESSAGE, attachPhotos, reviewsEnabled } from "@/lib/reviews";
import { notifyStaffReview } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** Customer edits their OWN review — only until it is approved. An edited review goes back to "pending". */
export async function PUT(req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) return bad("Login required", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Review not found", 404);
  const c = await db();
  if (!(await reviewsEnabled(c))) return bad("Reviews are turned off right now", 403);
  if (!(await rateLimit(`review-edit:${user.id}`, 30, 3600))) return bad("Too many changes. Please try again later.", 429);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const r = cleanReview(b);
  const err = firstError(validateReview(r));
  if (err) return bad(err);
  // Approved reviews are final. The status check is part of the UPDATE itself, so an approval that lands a moment earlier still wins.
  const upd = await c.execute({ sql: "UPDATE reviews SET rating = ?, comment = ?, status = 'pending', updated_at = datetime('now') WHERE id = ? AND user_id = ? AND status != 'approved'", args: [r.rating, r.comment, id, user.id] });
  if (upd.rowsAffected !== 1) {
    const cur = (await c.execute({ sql: "SELECT status FROM reviews WHERE id = ? AND user_id = ?", args: [id, user.id] })).rows[0];
    return cur ? bad(LOCKED_MESSAGE, 403) : bad("Review not found", 404);
  }
  if (upd.rowsAffected !== 1) return bad("Review not found", 404);
  const photoErr = await attachPhotos(c, user.id, id, r.images);
  if (photoErr) return bad(photoErr);
  await notifyStaffReview(c, id, "edited");
  return NextResponse.json({ ok: true });
}

/** Customer deletes their own review while it is still pending or rejected (always allowed then, even if reviews are switched off). */
export async function DELETE(_: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) return bad("Login required", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Review not found", 404);
  const c = await db();
  const own = (await c.execute({ sql: "SELECT status FROM reviews WHERE id = ? AND user_id = ?", args: [id, user.id] })).rows[0];
  if (!own) return bad("Review not found", 404);
  if (own.status === "approved") return bad(LOCKED_MESSAGE, 403);
  await c.batch([{ sql: "DELETE FROM review_images WHERE review_id = ?", args: [id] }, { sql: "DELETE FROM reviews WHERE id = ? AND user_id = ? AND status != 'approved'", args: [id, user.id] }], "write");
  return NextResponse.json({ ok: true });
}
