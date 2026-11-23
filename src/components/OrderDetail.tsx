import Img from "./Img";
import { inr } from "@/lib/types";
import { statusColor } from "./OrderList";
import { SHOP_VENDOR } from "@/lib/staffLabel";
import { formatIst } from "@/lib/istDate";
import { payLabel } from "@/lib/payLabel";
import type { FullOrder, OrderItem } from "@/lib/orderItems";

const STEPS = ["Placed", "Confirmed", "Shipped", "Delivered"];

/** Full order view (no hooks, so usable from server and client components). `actions` renders in the header (e.g. status control). */
export default function OrderDetail({ o, admin, actions, itemExtra }: { o: FullOrder; admin?: boolean; actions?: React.ReactNode; itemExtra?: (item: OrderItem) => React.ReactNode }) {
  const cancelled = o.status === "Cancelled";
  const online = o.payment_method === "online";
  const step = STEPS.indexOf(o.status);
  const count = o.items.reduce((s, i) => s + i.qty, 0);
  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center gap-3 p-5">
        <div>
          <h1 className="text-xl font-bold text-brand-700">Order #{o.id}</h1>
          <p className="text-sm text-gray-500">Placed on {formatIst(o.created_at)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor(o.status)}`}>{o.status}</span>
        <div className="ml-auto">{actions}</div>
      </section>

      <section className="card p-5">
        {cancelled ? (
          <p className="font-medium text-red-600">✕ This order was cancelled.</p>
        ) : (
          <ol className="flex items-center">
            {STEPS.map((s, n) => (
              <li key={s} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${n <= step ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-500"}`}>{n <= step ? "✓" : n + 1}</span>
                  <span className={`text-xs ${n <= step ? "font-semibold text-brand-700" : "text-gray-400"}`}>{s}</span>
                </div>
                {n < STEPS.length - 1 && <div className={`mx-2 mb-5 h-0.5 flex-1 ${n < step ? "bg-brand-600" : "bg-gray-200"}`} />}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b bg-gray-50 px-5 py-3 font-bold">Items ({count})</h2>
        <ul className="divide-y">
          {o.items.map((i, n) => (
            <li key={n} className="p-4">
             <div className="flex items-center gap-4">
              <Img src={i.image_url} alt={i.title} sizes="80px" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{i.title}</p>
                {i.size && <span className="mt-1 inline-block rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">Size: {i.size}</span>}
                {!admin && <span className="ml-1 mt-1 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Sold by {SHOP_VENDOR}</span>}
                {admin && i.added_by && <span className="ml-1 mt-1 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600" title="The admin who added this product">Added by {i.added_by}</span>}
                <p className="mt-1 text-sm text-gray-500">{inr(i.price)} × {i.qty}</p>
              </div>
              <p className="font-semibold">{inr(i.price * i.qty)}</p>
             </div>
             {itemExtra?.(i)}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold">{admin ? "Customer & delivery address" : "Delivery address"}</h2>
          <p className="font-semibold">{o.customer_name}</p>
          <address className="mt-1 text-sm not-italic leading-relaxed text-gray-700">
            {o.house_name}<br />{o.street_name}<br />{o.city}, {o.state}<br />PIN {o.pincode}
          </address>
          <a href={`tel:${o.phone}`} className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">📞 {o.phone}</a>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Payment summary</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Items ({count})</span><span>{inr(Number(o.total) + Number(o.discount || 0))}</span></div>
            {Number(o.discount) > 0 && <div className="flex justify-between text-green-700"><span>New user voucher</span><span>− {inr(Number(o.discount))}</span></div>}
            <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span className="text-brand-700">Free</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Payment method</span><span>{online ? "Online (Razorpay)" : "Cash on Delivery"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Payment status</span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${payLabel(o).tone}`}>{payLabel(o).text}</span></div>
            {online && o.razorpay_payment_id && <div className="flex justify-between gap-3"><span className="text-gray-500">Transaction ID</span><span className="break-all font-mono text-xs">{o.razorpay_payment_id}</span></div>}
            <hr className="my-2" />
            <div className="flex justify-between text-base font-bold"><span>{online ? (o.payment_status === "Paid" ? "Total paid" : o.payment_status === "Refunded" ? "Total refunded" : "Total") : "Total to pay"}</span><span className="text-brand-700">{inr(o.total)}</span></div>
            {online && o.status === "Cancelled" && o.payment_status === "Paid" && <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">{admin ? "Cancelled but paid — refund it from Admin → Payments." : "This order was cancelled. Your refund is being processed to your original payment method."}</p>}
            {online && o.payment_status === "Refunded" && <p className="mt-2 rounded bg-blue-50 p-2 text-xs text-blue-800">Refund issued to the original payment method (usually 5–7 working days to show up).</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
