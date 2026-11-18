import Img from "./Img";
import { inr } from "@/lib/types";
import { statusColor } from "./OrderList";
import type { FullOrder } from "@/lib/orderItems";

const STEPS = ["Placed", "Confirmed", "Shipped", "Delivered"];

/** Full order view (no hooks, so usable from server and client components). `actions` renders in the header (e.g. status control). */
export default function OrderDetail({ o, admin, actions }: { o: FullOrder; admin?: boolean; actions?: React.ReactNode }) {
  const cancelled = o.status === "Cancelled";
  const step = STEPS.indexOf(o.status);
  const count = o.items.reduce((s, i) => s + i.qty, 0);
  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center gap-3 p-5">
        <div>
          <h1 className="text-xl font-bold text-brand-700">Order #{o.id}</h1>
          <p className="text-sm text-gray-500">Placed on {o.created_at}</p>
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
            <li key={n} className="flex items-center gap-4 p-4">
              <Img src={i.image_url} alt={i.title} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{i.title}</p>
                {i.size && <span className="mt-1 inline-block rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">Size: {i.size}</span>}
                <p className="mt-1 text-sm text-gray-500">{inr(i.price)} × {i.qty}</p>
              </div>
              <p className="font-semibold">{inr(i.price * i.qty)}</p>
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
            <div className="flex justify-between"><span className="text-gray-500">Items ({count})</span><span>{inr(o.total)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span className="text-brand-700">Free</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Payment method</span><span>Cash on Delivery</span></div>
            <hr className="my-2" />
            <div className="flex justify-between text-base font-bold"><span>Total to pay</span><span className="text-brand-700">{inr(o.total)}</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}
