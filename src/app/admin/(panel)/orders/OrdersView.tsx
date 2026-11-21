import Link from "next/link";
import OrderRow from "@/components/OrderRow";
import Pagination from "@/components/Pagination";
import StatusSelect from "./StatusSelect";
import { statusColor } from "@/components/OrderList";

/** Read-only status for orders the viewer may not change. */
function ViewOnly({ status }: { status: string }) {
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor(status)}`}>{status}</span>
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500" title="This order has none of your products">View only</span>
    </div>
  );
}
import DateFilter, { type Range } from "./DateFilter";
import { inr } from "@/lib/types";
import { longDay, longMonth } from "@/lib/istDate";
import { ORDER_STATUSES } from "@/lib/types";
import type { FullOrder } from "@/lib/orderItems";
import type { PageInfo } from "@/lib/paginate";

const dot: Record<string, string> = { Placed: "bg-amber-400", Confirmed: "bg-amber-500", Shipped: "bg-blue-500", Delivered: "bg-green-500", Cancelled: "bg-red-500" };

export default function OrdersView({ orders, counts, status, pi, scoped = false, range, sales, today, yesterday, thisMonth }: { orders: (FullOrder & { editable?: boolean })[]; counts: Record<string, number>; status: string; pi: PageInfo; scoped?: boolean; range: Range; sales: number; today: string; yesterday: string; thisMonth: string }) {
  const dateParam: Record<string, string> = range.kind === "all" ? { date: "all" } : range.kind === "month" ? { month: range.value } : { date: range.value };
  const href = (s: string, page = 1) => `/admin/orders?${new URLSearchParams({ ...dateParam, ...(s !== "All" ? { status: s } : {}), ...(page > 1 ? { page: String(page) } : {}) })}`;
  const title = range.kind === "all" ? "All dates" : range.kind === "month" ? longMonth(range.value) : range.value === today ? `Today · ${longDay(range.value)}` : longDay(range.value);
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold">Orders <span className="text-base font-medium text-gray-500">— {title}</span></h1>{scoped && <p className="text-sm text-gray-500">You can view every order, but change the status only of orders that include products you added.</p>}</div>
      <DateFilter range={range} today={today} yesterday={yesterday} thisMonth={thisMonth} status={status} />
      <p className="text-sm text-gray-600"><b>{counts.All ?? 0}</b> order{counts.All === 1 ? "" : "s"} · Sales <b className="text-brand-700">{inr(sales)}</b> <span className="text-xs text-gray-400">(excludes cancelled and unpaid online orders)</span></p>
      <div className="flex flex-wrap gap-2">
        {["All", ...ORDER_STATUSES].map((s) => (
          <Link key={s} href={href(s)} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${status === s ? "border-brand-600 bg-brand-600 text-white" : "bg-white hover:bg-brand-50"}`}>
            {s !== "All" && <span className={`h-2 w-2 rounded-full ${dot[s]}`} />}{s}
            <span className={`rounded-full px-1.5 text-xs ${status === s ? "bg-white/25" : "bg-gray-100 text-gray-600"}`}>{counts[s] ?? 0}</span>
          </Link>
        ))}
      </div>
      {orders.length === 0 && <div className="card p-10 text-center text-gray-500">No orders for this date. Try another date, or “All dates”.</div>}
      {orders.map((o) => (
        <OrderRow key={`${o.id}-${o.status}`} o={o} href={`/admin/orders/${o.id}`} iconView statusControl={o.editable === false ? <ViewOnly status={o.status} /> : <StatusSelect id={Number(o.id)} status={o.status} />} extra={<p className="text-sm text-gray-600">👤 {o.customer_name} · 📞 {o.phone}</p>} />
      ))}
      <Pagination page={pi.page} totalPages={pi.totalPages} total={pi.total} hrefFor={(p) => href(status, p)} />
    </div>
  );
}
