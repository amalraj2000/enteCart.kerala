import type { Client } from "@libsql/client";
import { notifyNewOrder } from "@/lib/notify";
import { fetchPaymentInfo } from "@/lib/razorpay";

/** A Razorpay order was created for this shop order (payment attempt started). One row per attempt. */
export async function recordAttempt(c: Client, orderId: number, razorpayOrderId: string, amount: number) {
  await c.execute({ sql: "INSERT OR IGNORE INTO payments (order_id, razorpay_order_id, amount, status) VALUES (?,?,?, 'Created')", args: [orderId, razorpayOrderId, amount] });
}

/**
 * Money was captured: mark the payment row and the order Paid. Safe to call twice.
 * Stores ONLY ids, amount, method and a harmless description (card network + last 4, bank…). Never card numbers, CVV or expiry.
 */
export async function markPaid(c: Client, orderId: number, razorpayOrderId: string, paymentId: string, origin?: string) {
  const info = await fetchPaymentInfo(paymentId);
  const o = (await c.execute({ sql: "SELECT total FROM orders WHERE id = ?", args: [orderId] })).rows[0];
  await c.execute({ sql: "INSERT OR IGNORE INTO payments (order_id, razorpay_order_id, amount, status) VALUES (?,?,?, 'Created')", args: [orderId, razorpayOrderId, Number(o?.total || 0)] });
  await c.execute({
    sql: "UPDATE payments SET status = 'Paid', razorpay_payment_id = ?, method = ?, method_detail = ?, paid_at = datetime('now') WHERE razorpay_order_id = ? AND status = 'Created'",
    args: [paymentId, info?.method || "", info?.detail || "", razorpayOrderId],
  });
  const r = await c.execute({ sql: "UPDATE orders SET payment_status = 'Paid', razorpay_payment_id = ? WHERE id = ? AND payment_status = 'Unpaid'", args: [paymentId, orderId] });
  if (r.rowsAffected === 1) { // first time only — owner gets the WhatsApp alert now that the money is in
    await notifyNewOrder({ id: orderId, paidOnline: true, adminUrl: origin ? `${origin}/admin/orders/${orderId}` : undefined });
  }
}
