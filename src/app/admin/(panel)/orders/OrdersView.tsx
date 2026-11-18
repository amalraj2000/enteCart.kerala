import Link from "next/link";
import OrderRow from "@/components/OrderRow";
import Pagination from "@/components/Pagination";
import StatusSelect from "./StatusSelect";
import { ORDER_STATUSES } from "@/lib/types";
import type { FullOrder } from "@/lib/orderItems";
import type { PageInfo } from "@/lib/paginate";

const dot: Record<string, string> = { Placed: "bg-amber-400", Confirmed: "bg-amber-500", Shipped: "bg-blue-500", Delivered: "bg-green-500", Cancelled: "bg-red-500" };

export default function OrdersView({ orders, counts, status, pi }: { orders: FullOrder[]; counts: Record<string, number>; status: string; pi: PageInfo }) {
  const href = (s: string, page = 1) => `/admin/orders?${new URLSearchParams({ ...(s !== "All" ? { status: s } : {}), ...(page > 1 ? { page: String(page) } : {}) })}`;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Orders</h1>
      <div className="flex flex-wrap gap-2">
        {["All", ...ORDER_STATUSES].map((s) => (
          <Link key={s} href={href(s)} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${status === s ? "border-brand-600 bg-brand-600 text-white" : "bg-white hover:bg-brand-50"}`}>
            {s !== "All" && <span className={`h-2 w-2 rounded-full ${dot[s]}`} />}{s}
            <span className={`rounded-full px-1.5 text-xs ${status === s ? "bg-white/25" : "bg-gray-100 text-gray-600"}`}>{counts[s] ?? 0}</span>
          </Link>
        ))}
      </div>
      {orders.length === 0 && <div className="card p-10 text-center text-gray-500">No orders here yet.</div>}
      {orders.map((o) => (
        <OrderRow key={`${o.id}-${o.status}`} o={o} href={`/admin/orders/${o.id}`} statusControl={<StatusSelect id={Number(o.id)} status={o.status} />} extra={<p className="text-sm text-gray-600">👤 {o.customer_name} · 📞 {o.phone}</p>} />
      ))}
      <Pagination page={pi.page} totalPages={pi.totalPages} total={pi.total} hrefFor={(p) => href(status, p)} />
    </div>
  );
}
