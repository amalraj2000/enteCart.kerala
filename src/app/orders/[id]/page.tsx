"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useApp } from "@/components/Providers";
import OrderDetail from "@/components/OrderDetail";
import type { FullOrder } from "@/lib/orderItems";

export default function MyOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, authReady, openAuth } = useApp();
  const [o, setO] = useState<FullOrder | null | undefined>(undefined);
  useEffect(() => {
    if (user) fetch(`/api/orders/${id}`).then((r) => r.json()).then((d) => setO(d.order || null));
  }, [user, id]);

  if (!authReady) return null;
  if (!user) return <div className="card p-8 text-center"><p className="mb-3">Log in to view this order.</p><button className="btn-primary" onClick={() => openAuth()}>Login / Sign up</button></div>;
  if (o === undefined) return <p>Loading…</p>;
  if (o === null) return <p className="card p-8 text-center text-gray-600">Order not found.</p>;
  return (
    <div className="space-y-4">
      <Link href="/orders" className="text-sm font-medium text-brand-700 hover:underline">← Back to my orders</Link>
      <OrderDetail o={o} />
    </div>
  );
}
