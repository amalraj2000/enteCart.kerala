import type { Client } from "@libsql/client";
import { refundRazorpayPayment } from "@/lib/razorpay";

/**
 * Full refund of an order's captured payment to the customer's original payment method.
 * Claims the payment row first so two callers (customer cancel + admin button) can never refund twice.
 * Returns { ok: true } (or nothing to refund), or { ok: false, error } — in which case the payment stays "Paid" and
 * shows as "Refund due" in Admin → Payments for a manual retry.
 */
export async function refundOrder(c: Client, orderId: number): Promise<{ ok: true; refundId?: string } | { ok: false; error: string }> {
  const p = (await c.execute({ sql: "SELECT id, razorpay_payment_id, amount FROM payments WHERE order_id = ? AND status = 'Paid' ORDER BY id DESC LIMIT 1", args: [orderId] })).rows[0];
  if (!p) return { ok: true }; // never paid (or already refunded): nothing to give back
  const claim = await c.execute({ sql: "UPDATE payments SET status = 'Refunding' WHERE id = ? AND status = 'Paid'", args: [Number(p.id)] });
  if (claim.rowsAffected !== 1) return { ok: false, error: "A refund is already in progress" };
  try {
    const refundId = await refundRazorpayPayment(String(p.razorpay_payment_id), Number(p.amount), orderId);
    await c.execute({ sql: "UPDATE payments SET status = 'Refunded', refund_id = ?, refunded_at = datetime('now') WHERE id = ?", args: [refundId, Number(p.id)] });
    await c.execute({ sql: "UPDATE orders SET payment_status = 'Refunded' WHERE id = ?", args: [orderId] });
    return { ok: true, refundId };
  } catch (e) {
    await c.execute({ sql: "UPDATE payments SET status = 'Paid' WHERE id = ? AND status = 'Refunding'", args: [Number(p.id)] });
    return { ok: false, error: e instanceof Error ? e.message : "Refund failed" };
  }
}
