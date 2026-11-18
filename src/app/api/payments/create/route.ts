import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { parseId } from "@/lib/validate";
import { rateLimit } from "@/lib/rateLimit";
import { recordAttempt } from "@/lib/payments";
import { createRazorpayOrder, razorpayConfigured } from "@/lib/razorpay";
export const dynamic = "force-dynamic";

/** Creates (or re-creates, for a retry) the Razorpay order for one of the customer's unpaid online orders. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return bad("Login required", 401);
  const b = await readJson(req);
  const id = parseId(String(b?.orderId ?? ""));
  if (!id) return bad("Order not found", 404);
  if (!razorpayConfigured()) return bad("Online payment is not set up yet", 503);

  if (!(await rateLimit(`paycreate:${user.id}`, 20, 600))) return bad("Too many payment attempts. Please wait a few minutes.", 429);

  const c = await db();
  const o = (await c.execute({ sql: "SELECT id, total, status, payment_method, payment_status, razorpay_order_id FROM orders WHERE id = ? AND user_id = ?", args: [id, user.id] })).rows[0];
  if (!o) return bad("Order not found", 404);
  if (o.payment_method !== "online" || o.payment_status !== "Unpaid") return bad("This order doesn't need a payment", 409);
  if (o.status === "Cancelled") return bad("This order was cancelled", 409);

  // ONE Razorpay order per shop order: a retry reuses it, so the customer can never end up paying two different
  // Razorpay orders for the same purchase (a double charge we couldn't match up).
  if (o.razorpay_order_id) return NextResponse.json({ key: process.env.RAZORPAY_KEY_ID, razorpayOrderId: String(o.razorpay_order_id), amount: Math.round(Number(o.total) * 100), orderId: id });
  try {
    // The amount always comes from the DB total, never from the browser.
    const rp = await createRazorpayOrder(Number(o.total), `order_${id}`);
    await c.execute({ sql: "UPDATE orders SET razorpay_order_id = ? WHERE id = ?", args: [rp.id, id] });
    await recordAttempt(c, id, rp.id, Number(o.total)); // transaction log (shown to the super admin)
    return NextResponse.json({ key: process.env.RAZORPAY_KEY_ID, razorpayOrderId: rp.id, amount: rp.amount, orderId: id });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not start payment", 502);
  }
}
