"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/Providers";
import OrderRow from "@/components/OrderRow";
import Pagination from "@/components/Pagination";
import type { FullOrder } from "@/lib/orderItems";

export default function MyOrders() {
  const { user, authReady, openAuth } = useApp();
  const [orders, setOrders] = useState<FullOrder[] | null>(null);
  const [pg, setPg] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (user) fetch(`/api/orders?page=${page}`).then((r) => r.json()).then((d) => { setOrders(d.orders || []); setPg({ page: d.page, totalPages: d.totalPages, total: d.total }); });
  }, [user, page]);

  if (!authReady) return null;
  if (!user) return <div className="card p-8 text-center"><p className="mb-3">Log in to see your orders.</p><button className="btn-primary" onClick={() => openAuth()}>Login / Register</button></div>;
  if (!orders) return <p>Loading…</p>;
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">My Orders</h1>
      {orders.length === 0 && <p className="text-gray-500">You haven't placed any orders yet.</p>}
      {orders.map((o) => <OrderRow key={o.id} o={o} href={`/orders/${o.id}`} />)}
      <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
    </div>
  );
}
