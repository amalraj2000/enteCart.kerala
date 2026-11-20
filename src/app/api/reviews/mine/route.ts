import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { bad } from "@/lib/http";
import { resolveOwnOrder } from "@/lib/orderRef";
import { reviewsEnabled, withPhotos } from "@/lib/reviews";
export const dynamic = "force-dynamic";

/** GET /api/reviews/mine?order=<id or public id> → { enabled, canReview, reviews } for the products of one of the customer's own orders. */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return bad("Login required", 401);
  const c = await db();
  const own = await resolveOwnOrder(c, user.id, new URL(req.url).searchParams.get("order") || "");
  if (!own) return bad("Order not found", 404);
  const enabled = await reviewsEnabled(c);
  const status = String((await c.execute({ sql: "SELECT status FROM orders WHERE id = ? AND user_id = ?", args: [own.id, user.id] })).rows[0]?.status);
  const rows = (await c.execute({
    sql: `SELECT r.id, r.product_id, r.rating, r.comment, r.status, r.active, r.created_at FROM reviews r
          WHERE r.user_id = ? AND r.product_id IN (SELECT product_id FROM order_items WHERE order_id = ? AND product_id IS NOT NULL)`,
    args: [user.id, own.id],
  })).rows.map((r) => ({ id: Number(r.id), product_id: Number(r.product_id), rating: Number(r.rating), comment: String(r.comment), status: String(r.status), active: Number(r.active) === 1, created_at: String(r.created_at) }));
  return NextResponse.json({ enabled, canReview: enabled && status === "Delivered", reviews: await withPhotos(c, rows) });
}
