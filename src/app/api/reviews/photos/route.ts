import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { IMAGE_DATA_RE, magicOk } from "@/lib/imageData";
import { reviewsEnabled } from "@/lib/reviews";

/** Customer uploads ONE review photo (client-compressed data URL). It stays private to them and the admins until its review is approved. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return bad("Please log in", 401);
  if (!(await rateLimit(`review-photo:${user.id}`, 30, 3600))) return bad("Too many uploads. Please try again later.", 429);
  const b = await readJson(req, 650_000);
  if (!b || typeof b.data !== "string") return bad("Invalid request");
  const m = IMAGE_DATA_RE.exec(b.data);
  if (!m || b.data.length > 450_000) return bad("Invalid or too large image");
  if (!magicOk(m[1], m[2])) return bad("File is not a valid image");
  const c = await db();
  if (!(await reviewsEnabled(c))) return bad("Reviews are turned off right now", 403);
  // At most a handful of photos waiting to be attached, so nobody can use this as free image storage.
  const pending = Number((await c.execute({ sql: "SELECT COUNT(*) AS n FROM review_images WHERE user_id = ? AND review_id IS NULL", args: [user.id] })).rows[0].n);
  if (pending >= 12) return bad("Too many unused photos. Submit your review first.", 429);
  const r = await c.execute({ sql: "INSERT INTO review_images (user_id, data) VALUES (?, ?)", args: [user.id, b.data] });
  if (Math.random() < 0.05) await c.execute("DELETE FROM review_images WHERE review_id IS NULL AND created_at < datetime('now','-1 day')"); // abandoned uploads
  return NextResponse.json({ url: `/api/review-images/${Number(r.lastInsertRowid)}` });
}
