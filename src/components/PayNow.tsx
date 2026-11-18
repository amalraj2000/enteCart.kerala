"use client";
import { useState } from "react";
import { toast } from "@/components/Toaster";
import { openPayment, verifyPayment } from "@/lib/payClient";

/** Shown on an online order that hasn't been paid yet (popup closed, payment failed…). */
export default function PayNow({ orderId, onDone }: { orderId: number; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function pay() {
    setBusy(true);
    try {
      await openPayment(orderId, {}, {
        onPaid: async (res) => {
          const ok = await verifyPayment(orderId, res);
          if (ok) toast.success("Payment successful!"); else toast.error("We're still confirming your payment. Please check again in a minute.");
          setBusy(false); onDone();
        },
        onDismiss: () => setBusy(false),
        onFailed: () => toast.error("Payment failed. You can try again."),
      });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not start payment"); setBusy(false); }
  }
  return (
    <div className="card flex flex-wrap items-center gap-3 border-amber-300 bg-amber-50 p-4">
      <p className="flex-1 text-sm text-amber-900">💳 <b>Payment pending.</b> Your order is saved but not paid yet. Complete the payment to confirm it.</p>
      <button className="btn-primary" onClick={pay} disabled={busy}>{busy ? "Please wait…" : "Pay now"}</button>
    </div>
  );
}
