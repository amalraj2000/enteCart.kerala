/* Browser-only helpers for the Razorpay popup (shared by checkout and the "Pay now" button). */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function loadRazorpay() {
  return new Promise<void>((ok, fail) => {
    if ((window as any).Razorpay) return ok();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => ok(); s.onerror = () => fail(new Error("Could not load the payment window"));
    document.body.appendChild(s);
  });
}

/** Asks our server for a Razorpay order for this shop order, then opens the popup. */
export async function openPayment(orderId: number, prefill: { name?: string; contact?: string }, h: { onPaid: (res: Record<string, string>) => void; onDismiss: () => void; onFailed?: () => void }) {
  const p = await fetch("/api/payments/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) }).then((x) => x.json());
  if (!p.razorpayOrderId) throw new Error(p.error || "Could not start payment");
  await loadRazorpay();
  const rz = new (window as any).Razorpay({
    key: p.key, amount: p.amount, currency: "INR", order_id: p.razorpayOrderId, name: "enteCart Kerala", description: `Order #${orderId}`, prefill,
    handler: h.onPaid, modal: { ondismiss: h.onDismiss },
  });
  if (h.onFailed) rz.on("payment.failed", h.onFailed);
  rz.open();
}

export async function verifyPayment(orderId: number, res: Record<string, string>): Promise<boolean> {
  for (let t = 0; t < 3; t++) {
    const v = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, ...res }) }).catch(() => null);
    if (v?.ok) return true;
    if (t < 2) await new Promise((w) => setTimeout(w, 1500));
  }
  return false;
}
