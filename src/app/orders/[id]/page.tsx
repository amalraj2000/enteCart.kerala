"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useApp } from "@/components/Providers";
import OrderDetail from "@/components/OrderDetail";
import InfoTip from "@/components/InfoTip";
import { toast } from "@/components/Toaster";
import { CANCEL_POLICY, canCancel } from "@/lib/orderPolicy";
import type { FullOrder } from "@/lib/orderItems";

export default function MyOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, authReady, openAuth } = useApp();
  const [o, setO] = useState<FullOrder | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const load = () => fetch(`/api/orders/${id}`).then((r) => r.json()).then((d) => setO(d.order || null));
  useEffect(() => { if (user) load(); }, [user, id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cancel() {
    if (!confirm("Cancel this order? This can't be undone.")) return;
    setBusy(true);
    const r = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
    setBusy(false);
    if (r.ok) toast.success("Your order has been cancelled");
    else toast.error((await r.json().catch(() => ({}))).error || "Could not cancel the order");
    load(); // shows the real status either way (e.g. it was confirmed a moment ago)
  }

  if (!authReady) return null;
  if (!user) return <div className="card p-8 text-center"><p className="mb-3">Log in to view this order.</p><button className="btn-primary" onClick={() => openAuth()}>Login / Sign up</button></div>;
  if (o === undefined) return <p>Loading…</p>;
  if (o === null) return <p className="card p-8 text-center text-gray-600">Order not found.</p>;

  const actions = canCancel(o.status) ? (
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
      <OrderDetail o={o} actions={actions} />
      {canCancel(o.status) && <p className="text-xs text-gray-500">You can cancel this order only while it is “Placed”. Once it is confirmed, it can’t be cancelled and returns are not available.</p>}
    </div>
  );
}
