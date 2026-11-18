import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { parseId } from "@/lib/validate";
import { markPaid } from "@/lib/payments";
import { rateLimit } from "@/lib/rateLimit";
import { refundOrder } from "@/lib/refund";
import { razorpayConfigured, verifySignature } from "@/lib/razorpay";
export const dynamic = "force-dynamic";

/** Browser calls this after Razorpay's checkout succeeds. Marks the order Paid only if the signature is genuine. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return bad("Login required", 401);
  if (!razorpayConfigured()) return bad("Online payment is not set up", 503); // never verify against an empty secret
  if (!(await rateLimit(`payverify:${user.id}`, 30, 600))) return bad("Too many attempts. Please wait a few minutes.", 429);
  const b = await readJson(req);
  const id = parseId(String(b?.orderId ?? ""));
  const rpOrder = String(b?.razorpay_order_id ?? ""), rpPay = String(b?.razorpay_payment_id ?? ""), sig = String(b?.razorpay_signature ?? "");
  if (!id || !rpOrder || !rpPay || !sig) return bad("Invalid request");

  const c = await db();
  const o = (await c.execute({ sql: "SELECT razorpay_order_id, status FROM orders WHERE id = ? AND user_id = ?", args: [id, user.id] })).rows[0];
  if (!o) return bad("Order not found", 404);
  if (String(o.razorpay_order_id) !== rpOrder || !verifySignature(rpOrder, rpPay, sig)) return bad("Payment could not be verified", 400);

  await markPaid(c, id, rpOrder, rpPay, new URL(req.url).origin);
  // Paid on a popup that was left open after the order got cancelled (customer or expiry): give the money straight back.
  if (o.status === "Cancelled") { await refundOrder(c, id); return NextResponse.json({ ok: true, cancelled: true }); }
  return NextResponse.json({ ok: true });
}
