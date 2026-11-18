import Link from "next/link";
import Img from "./Img";
import { inr } from "@/lib/types";
import { statusColor } from "./OrderList";
import type { FullOrder } from "@/lib/orderItems";

/** Compact order summary: photo, name, status, total and a View button. */
export default function OrderRow({ o, href, extra }: { o: FullOrder; href: string; extra?: React.ReactNode }) {
  const first = o.items[0];
  const more = o.items.length - 1;
  return (
    <div className="card flex flex-wrap items-center gap-4 p-4">
      <div className="relative shrink-0">
        <Img src={first?.image_url || ""} alt={first?.title || "Order"} className="h-20 w-20 rounded-lg object-cover" />
        {more > 0 && <span className="absolute -bottom-1 -right-1 rounded-full bg-brand-700 px-1.5 text-xs font-semibold text-white">+{more}</span>}
      </div>
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate font-semibold">{first?.title || "Order"}{more > 0 && <span className="font-normal text-gray-500"> and {more} more</span>}</p>
        <p className="text-sm text-gray-500">Order #{o.id} · {o.created_at}</p>
        {extra}
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor(o.status)}`}>{o.status}</span>
        <span className="font-bold text-brand-700">{inr(o.total)}</span>
      </div>
      <Link href={href} className="btn-outline">View</Link>
    </div>
  );
}
