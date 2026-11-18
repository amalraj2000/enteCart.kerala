import type { Client } from "@libsql/client";
import { refundOrder } from "@/lib/refund";
import { markPaid } from "@/lib/payments";
import { hasCapturedPayment, razorpayConfigured } from "@/lib/razorpay";

/**
 * Safety net for "customer paid but closed the tab / pressed back before we recorded it":
 * if an online order is still Unpaid, ask Razorpay itself and mark it Paid when money was captured.
 * Returns the order's payment_status after the check. Never throws.
 */
export async function reconcilePayment(c: Client, orderId: number): Promise<string> {
  const o = (await c.execute({ sql: "SELECT payment_method, payment_status, razorpay_order_id FROM orders WHERE id = ?", args: [orderId] })).rows[0];
  if (!o) return "";
  const status = String(o.payment_status);
  if (o.payment_method !== "online" || status !== "Unpaid" || !o.razorpay_order_id || !razorpayConfigured()) return status;
  try {
    const payId = await hasCapturedPayment(String(o.razorpay_order_id));
    if (!payId) return status;
    await markPaid(c, orderId, String(o.razorpay_order_id), payId);
    const st = (await c.execute({ sql: "SELECT status FROM orders WHERE id = ?", args: [orderId] })).rows[0];
    if (st?.status === "Cancelled") return (await refundOrder(c, orderId)).ok ? "Refunded" : "Paid"; // paid after cancellation → refund
    return "Paid";
  } catch { return status; }
}
