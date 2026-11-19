import { createHmac, timingSafeEqual } from "node:crypto";

export const razorpayConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

/** Creates a Razorpay order for `amountRupees`. Amount is converted to paise here. Test keys (rzp_test_…) = no real money. */
export async function createRazorpayOrder(amountRupees: number, receipt: string): Promise<{ id: string; amount: number }> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const r = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: "INR", receipt }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.id) throw new Error(d?.error?.description || "Razorpay order creation failed");
  return { id: String(d.id), amount: Number(d.amount) };
}

/** Checks the signature Razorpay returns to the browser after a successful payment. */
export function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "").update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checks the X-Razorpay-Signature header of a webhook call (HMAC-SHA256 of the raw body with the webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Asks Razorpay directly whether an order has a captured payment (used when the browser never reported back). */
export async function hasCapturedPayment(razorpayOrderId: string): Promise<string | null> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const r = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(razorpayOrderId)}/payments`, { headers: { Authorization: `Basic ${auth}` } });
  const d = await r.json().catch(() => ({}));
  const p = (d.items || []).find((x: { status: string }) => x.status === "captured");
  return p ? String(p.id) : null;
}

const basic = () => "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");

/** Non-sensitive description of how the customer paid, e.g. "Card · visa ····0153", "UPI", "Netbanking · HDFC". Never a full card number (Razorpay doesn't give us one, and we must not store one). */
export async function fetchPaymentInfo(paymentId: string): Promise<{ method: string; detail: string; amount: number } | null> {
  try {
    const r = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: basic() } });
    const d = await r.json();
    if (!r.ok) return null;
    const method = String(d.method || "");
    const detail = method === "card" && d.card ? `${d.card.network || "card"} ····${d.card.last4 || ""}` : method === "netbanking" ? String(d.bank || "") : method === "wallet" ? String(d.wallet || "") : "";
    return { method, detail, amount: Number(d.amount) / 100 };
  } catch { return null; }
}

/** Full refund of a captured payment to the customer's original payment method. Returns the refund id. */
export async function refundRazorpayPayment(paymentId: string, amountRupees: number, orderId: number): Promise<string> {
  const r = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "POST",
    headers: { Authorization: basic(), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(amountRupees * 100), speed: "normal", notes: { order: String(orderId) } }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.id) throw new Error(d?.error?.description || "Razorpay refund failed");
  return String(d.id);
}
