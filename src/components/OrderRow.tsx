import { orderLabel } from "@/lib/orderNo";
import Link from "next/link";
import Img from "./Img";
import IconBtn from "./IconBtn";
import { inr } from "@/lib/types";
import { statusColor } from "./OrderList";
import { formatIst } from "@/lib/istDate";
import { payLabel } from "@/lib/payLabel";
import type { FullOrder } from "@/lib/orderItems";

/** Compact order summary: photo, name, status, total and a View button. */
export default function OrderRow({ o, href, extra, statusControl, iconView }: { o: FullOrder; href: string; extra?: React.ReactNode; statusControl?: React.ReactNode; iconView?: boolean }) {
  const first = o.items[0];
  const more = o.items.length - 1;
  const owners = [...new Set(o.items.map((i) => i.added_by).filter(Boolean))] as string[]; // only present on staff screens
  return (
    <div className="card flex flex-wrap items-center gap-4 p-4">
      <div className="relative shrink-0">
        <Img src={first?.image_url || ""} alt={first?.title || "Order"} sizes="80px" className="h-20 w-20 rounded-lg object-cover" />
        {more > 0 && <span className="absolute -bottom-1 -right-1 rounded-full bg-brand-700 px-1.5 text-xs font-semibold text-white">+{more}</span>}
      </div>
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate font-semibold">{first?.title || "Order"}{more > 0 && <span className="font-normal text-gray-500"> and {more} more</span>}</p>
        <p className="text-sm text-gray-500">Order {orderLabel(o)} · {formatIst(o.created_at)}</p>
        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${payLabel(o).tone}`}>{o.payment_method === "online" ? "💳 " : "💵 "}{payLabel(o).text}</span>
        {extra}
        {owners.length > 0 && <p className="text-xs text-gray-500">🛍️ Products by <span className="font-medium text-gray-700">{owners.join(", ")}</span></p>}
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        {statusControl ?? <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor(o.status)}`}>{o.status}</span>}
        <span className="font-bold text-brand-700">{inr(o.total)}</span>
      </div>
      {iconView ? <IconBtn kind="view" label={`View order ${orderLabel(o)}`} href={href} /> : <Link href={href} className="btn-outline">View</Link>}
    </div>
  );
}
