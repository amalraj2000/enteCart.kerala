"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/Providers";
import OrderDetail from "@/components/OrderDetail";
import PayNow from "@/components/PayNow";
import InfoTip from "@/components/InfoTip";
import { toast } from "@/components/Toaster";
import { CANCEL_POLICY, canCancel } from "@/lib/orderPolicy";
import type { FullOrder } from "@/lib/orderItems";

export default function MyOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, authReady, openAuth } = useApp();
  const [o, setO] = useState<FullOrder | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const load = () => fetch(`/api/orders/${id}`).then((r) => r.json()).then((d) => { setO(d.order || null); if (d.order?.public_id && d.order.public_id !== id) router.replace(`/orders/${d.order.public_id}`); }); // old numeric link → opaque address
  useEffect(() => { if (user) load(); }, [user, id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cancel() {
    if (!confirm(paidOnline ? "Cancel this order? Your payment will be refunded to your original payment method in 5–7 working days. This can't be undone." : "Cancel this order? This can't be undone.")) return;
    setBusy(true);
    const r = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) toast.error(d.error || "Could not cancel the order");
    else if (d.refund === "done") toast.success("Order cancelled. Refund started — it reaches you in 5–7 working days");
    else if (d.refund === "pending") toast.success("Order cancelled. We'll process your refund shortly");
    else toast.success("Your order has been cancelled");
    load(); // shows the real status either way (e.g. it was confirmed a moment ago)
  }

  if (!authReady) return null;
  if (!user) return <div className="card p-8 text-center"><p className="mb-3">Log in to view this order.</p><button className="btn-primary" onClick={() => openAuth()}>Login / Register</button></div>;
  if (o === undefined) return <p>Loading…</p>;
  if (o === null) return <p className="card p-8 text-center text-gray-600">Order not found.</p>;

  const online = o.payment_method === "online";
  const paidOnline = online && o.payment_status === "Paid";
  const cancellable = canCancel(o.status);
  const actions = cancellable ? (
    <div className="flex items-center gap-2">
      <button className="btn-danger" onClick={cancel} disabled={busy}>{busy ? "Cancelling…" : "Cancel order"}</button>
      <InfoTip title="Cancellation policy" lines={CANCEL_POLICY} />
    </div>
  ) : o.status === "Cancelled" ? null : (
    <p className="flex items-center gap-2 text-sm text-gray-500">Can’t be cancelled <InfoTip title="Cancellation policy" lines={CANCEL_POLICY} /></p>
  );
  return (
    <div className="space-y-4">
      <Link href="/orders" className="text-sm font-medium text-brand-700 hover:underline">← Back to my orders</Link>
      {online && o.payment_status === "Unpaid" && o.status !== "Cancelled" && <PayNow orderId={o.id} onDone={load} />}
      <OrderDetail o={o} actions={actions} />
      {cancellable && <p className="text-xs text-gray-500">You can cancel this order only while it is “Placed”. Once it is confirmed, it can’t be cancelled and returns are not available.</p>}
    </div>
  );
}
