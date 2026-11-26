import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import Img from "@/components/Img";
import IconBtn from "@/components/IconBtn";
import { orderLabel } from "@/lib/orderNo";
import { payLabel } from "@/lib/payLabel";
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
import ExportDialog from "./ExportDialog";
import DateFilter, { type Range } from "./DateFilter";
import { inr } from "@/lib/types";
import { formatIst, longDay, longMonth } from "@/lib/istDate";
import { ORDER_STATUSES } from "@/lib/types";
import type { FullOrder } from "@/lib/orderItems";
import type { PageInfo } from "@/lib/paginate";

const dot: Record<string, string> = { Placed: "bg-amber-400", Confirmed: "bg-amber-500", Shipped: "bg-blue-500", Delivered: "bg-green-500", Cancelled: "bg-red-500" };

export default function OrdersView({ orders, counts, status, pi, scoped = false, range, q = "", hasInbox = false, sales, today, yesterday, thisMonth }: { orders: (FullOrder & { editable?: boolean; kind?: string })[]; counts: Record<string, number>; status: string; pi: PageInfo; scoped?: boolean; range: Range; q?: string; hasInbox?: boolean; sales: number; today: string; yesterday: string; thisMonth: string }) {
  const dateParam: Record<string, string> = range.kind === "all" ? { date: "all" } : range.kind === "month" ? { month: range.value } : { date: range.value };
  const href = (s: string, page = 1) => `/admin/orders?${new URLSearchParams({ ...dateParam, ...(s !== "All" ? { status: s } : {}), ...(q ? { q } : {}), ...(page > 1 ? { page: String(page) } : {}) })}`;
  const title = range.kind === "all" ? "All dates" : range.kind === "month" ? longMonth(range.value) : range.value === today ? `Today · ${longDay(range.value)}` : longDay(range.value);
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold">Orders <span className="text-base font-medium text-gray-500">— {title}</span></h1>{scoped && <p className="text-sm text-gray-500">You can view every order, but change the status only of orders that include products you added.</p>}</div>
      <SearchBox path="/admin/orders" q={q} params={{ ...dateParam, ...(status !== "All" ? { status } : {}) }} placeholder="Search order no, customer name, phone or email" />
      <DateFilter q={q} range={range} today={today} yesterday={yesterday} thisMonth={thisMonth} status={status} />
      <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-gray-600"><b>{counts.All ?? 0}</b> order{counts.All === 1 ? "" : "s"} · Sales <b className="text-brand-700">{inr(sales)}</b> <span className="text-xs text-gray-400">(excludes cancelled and unpaid online orders)</span></p>
      <ExportDialog today={today} yesterday={yesterday} thisMonth={thisMonth} hasInbox={hasInbox} />
      </div>
      <div className="flex flex-wrap gap-2">
        {["All", ...ORDER_STATUSES].map((s) => (
          <Link key={s} href={href(s)} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${status === s ? "border-brand-600 bg-brand-600 text-white" : "bg-white hover:bg-brand-50"}`}>
            {s !== "All" && <span className={`h-2 w-2 rounded-full ${dot[s]}`} />}{s}
            <span className={`rounded-full px-1.5 text-xs ${status === s ? "bg-white/25" : "bg-gray-100 text-gray-600"}`}>{counts[s] ?? 0}</span>
          </Link>
        ))}
      </div>
      {orders.length === 0 && <div className="card p-10 text-center text-gray-500">{q ? `No orders match “${q}”.` : "No orders for this date. Try another date, or “All dates”."}</div>}
      {orders.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="rtable w-full min-w-[860px] text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Products</th><th className="p-3">Payment</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => {
                const inbox = o.kind === "inbox";
                const first = o.items[0], more = o.items.length - 1;
                const pay = inbox ? { text: `${o.payment_method} · ${o.payment_status}`, tone: o.payment_status === "Paid" ? "bg-green-100 text-green-800" : o.payment_status === "Refunded" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700" } : payLabel(o);
                const label = o.order_no || undefined;
                return (
                  <tr key={`${inbox ? "i" : "w"}${o.id}-${o.status}`} className="align-middle">
                    <td data-label="Order" className="p-3"><p className="font-mono text-xs font-semibold">{orderLabel(o)}</p><p className="text-xs text-gray-500">{formatIst(o.created_at)}</p>
                      {inbox && <span className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-800">{INBOX_ICON[o.source]} {o.source}</span>}</td>
                    <td data-label="Customer" className="p-3"><p className="font-medium">{o.customer_name}</p><p className="text-xs text-gray-500">{o.phone}</p></td>
                    <td data-label="Products" className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <Img src={first?.image_url || ""} alt={first?.title || "Order"} sizes="48px" className="h-12 w-12 rounded-lg object-cover" />
                          {more > 0 && <span className="absolute -bottom-1 -right-1 rounded-full bg-brand-700 px-1.5 text-[10px] font-semibold text-white">+{more}</span>}
                        </div>
                        <p className="max-w-[14rem] truncate font-medium">{first?.title || "Order"}{more > 0 && <span className="font-normal text-gray-500"> and {more} more</span>}</p>
                      </div>
                    </td>
                    <td data-label="Payment" className="p-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${pay.tone}`}>{!inbox && (o.payment_method === "online" ? "💳 " : "💵 ")}{pay.text}</span></td>
                    <td data-label="Total" className="p-3 font-bold text-brand-700">{inr(Number(o.total))}</td>
                    <td data-label="Status" className="p-3">{o.editable === false ? <ViewOnly status={o.status} /> : <StatusSelect inbox={inbox} label={label} id={Number(o.id)} status={o.status} />}</td>
                    <td data-label="Action" className="p-3"><div className="flex justify-end">
                      <IconBtn kind="view" label={`View order ${orderLabel(o)}`} href={inbox ? `/admin/inbox-orders?q=${encodeURIComponent(o.order_no)}` : `/admin/orders/${o.id}`} />
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={pi.page} totalPages={pi.totalPages} total={pi.total} hrefFor={(p) => href(status, p)} />
    </div>
  );
}

const INBOX_ICON: Record<string, string> = { Instagram: "📸", Facebook: "📘", WhatsApp: "💬", Other: "✉️" };
