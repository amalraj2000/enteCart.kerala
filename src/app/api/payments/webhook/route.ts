import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markPaid } from "@/lib/payments";
import { refundOrder } from "@/lib/refund";
import { verifyWebhookSignature } from "@/lib/razorpay";
export const dynamic = "force-dynamic";

/**
 * Razorpay → us, server to server. Records a payment even when the customer closed the tab before our browser callback ran.
 * Set it up in Razorpay Dashboard → Webhooks: URL https://<your-domain>/api/payments/webhook, events `payment.captured` and `order.paid`,
 * and put the secret you choose there in RAZORPAY_WEBHOOK_SECRET. The signature is checked on the RAW body; anything else is rejected.
 */
export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const raw = await req.text().catch(() => "");
  if (!raw || raw.length > 100_000 || !verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature") || "", secret))
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  let evt: any;
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad payload" }, { status: 400 }); }
  if (evt?.event !== "payment.captured" && evt?.event !== "order.paid") return NextResponse.json({ ok: true, ignored: true });

  const pay = evt?.payload?.payment?.entity;
  const rpOrder = String(pay?.order_id || evt?.payload?.order?.entity?.id || ""), rpPay = String(pay?.id || "");
  if (!rpOrder || !rpPay || pay?.status !== "captured") return NextResponse.json({ ok: true, ignored: true });

  const c = await db();
  const o = (await c.execute({ sql: "SELECT id, status, total FROM orders WHERE razorpay_order_id = ?", args: [rpOrder] })).rows[0];
  if (!o) return NextResponse.json({ ok: true, ignored: true }); // not one of ours
  if (Math.round(Number(o.total) * 100) !== Number(pay?.amount)) { console.error(`Webhook amount mismatch on order ${o.id}`); return NextResponse.json({ ok: true, ignored: true }); }
  await markPaid(c, Number(o.id), rpOrder, rpPay, new URL(req.url).origin); // idempotent: the browser callback may have got there first
  if (o.status === "Cancelled") await refundOrder(c, Number(o.id)); // paid after it was cancelled / expired → give it back
  return NextResponse.json({ ok: true });
}
