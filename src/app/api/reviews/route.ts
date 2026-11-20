import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { approvedReviews, attachPhotos, deliveredOrderFor, reviewSummary, reviewsEnabled } from "@/lib/reviews";
import { cleanReview, firstError, validateReview } from "@/lib/validate";
export const dynamic = "force-dynamic";

/** Public: GET /api/reviews?product=12&offset=2 → the next batch of APPROVED reviews (2 at a time) + the rating summary. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const product = /^\d{1,12}$/.test(sp.get("product") || "") ? Number(sp.get("product")) : 0;
  const offset = /^\d{1,6}$/.test(sp.get("offset") || "") ? Number(sp.get("offset")) : 0;
  if (!product) return bad("Invalid product");
  if (!(await reviewsEnabled())) return NextResponse.json({ enabled: false, reviews: [], hasMore: false, avg: 0, count: 0 });
  const [{ reviews, hasMore }, sum] = await Promise.all([approvedReviews(product, offset), reviewSummary(product)]);
  return NextResponse.json({ enabled: true, reviews, hasMore, ...sum });
}

/** A customer reviews a product from a DELIVERED order of theirs. One review per product; it starts as "pending" until an admin approves it. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return bad("Please log in to write a review", 401);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const c = await db();
  if (!(await reviewsEnabled(c))) return bad("Reviews are turned off right now", 403);
  if (!(await rateLimit(`review:${user.id}`, 20, 3600))) return bad("Too many reviews. Please try again later.", 429);
  const productId = typeof b.productId === "number" && Number.isInteger(b.productId) && b.productId > 0 ? b.productId : 0;
  if (!productId) return bad("Invalid product");
  const r = cleanReview(b);
  const err = firstError(validateReview(r));
  if (err) return bad(err);

  // The rule that matters: only a customer whose order containing this product was Delivered may review it.
  const orderId = await deliveredOrderFor(c, user.id, productId);
  if (!orderId) return bad("You can review a product only after your order with it has been delivered", 403);
  if ((await c.execute({ sql: "SELECT 1 FROM reviews WHERE user_id = ? AND product_id = ?", args: [user.id, productId] })).rows.length) return bad("You have already reviewed this product — you can edit your review instead", 409);

  let id: number;
  try {
    id = Number((await c.execute({ sql: "INSERT INTO reviews (product_id, user_id, order_id, rating, comment) VALUES (?,?,?,?,?)", args: [productId, user.id, orderId, r.rating, r.comment] })).lastInsertRowid);
  } catch { return bad("You have already reviewed this product", 409); } // two quick taps: the UNIQUE key stops the second
  const photoErr = await attachPhotos(c, user.id, id, r.images);
  if (photoErr) { await c.execute({ sql: "DELETE FROM reviews WHERE id = ?", args: [id] }); return bad(photoErr); }
  return NextResponse.json({ ok: true, id });
}
