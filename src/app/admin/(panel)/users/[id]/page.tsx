import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { inr } from "@/lib/types";
import { Items, statusColor } from "@/components/OrderList";

const badge: Record<string, string> = { active: "bg-green-100 text-green-800", inactive: "bg-gray-200 text-gray-700", blocked: "bg-red-100 text-red-700" };

export const dynamic = "force-dynamic";

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db();
  const u = (await c.execute({ sql: "SELECT id, identifier, status, created_at FROM users WHERE id = ?", args: [Number(id) || 0] })).rows[0] as any;
  if (!u) notFound();
  const orders = (await c.execute({ sql: "SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC", args: [u.id] })).rows as any[];

  // Saved addresses = distinct delivery addresses used across this user's orders.
  const map = new Map<string, any>();
  for (const o of orders) {
    const k = [o.customer_name, o.phone, o.house_name, o.street_name, o.city, o.state, o.pincode].join("|").toLowerCase();
    const e = map.get(k);
    if (e) e.uses++;
    else map.set(k, { ...o, uses: 1 });
  }
  const addresses = [...map.values()];
  const spent = orders.filter((o) => o.status !== "Cancelled").reduce((s, o) => s + Number(o.total), 0);
  const isPhone = /^\d+$/.test(u.identifier);

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-sm font-medium text-brand-700 hover:underline">← Back to users</Link>

      <section className="card flex flex-wrap items-center gap-5 p-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-3xl font-bold text-white ring-4 ring-brand-100">{String(u.identifier)[0].toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="break-all text-xl font-bold">{u.identifier}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badge[u.status]}`}>{u.status}</span>
          </div>
          <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2"><dt className="text-gray-500">User ID</dt><dd className="font-medium">#{u.id}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500">{isPhone ? "Phone" : "Gmail"}</dt><dd className="font-medium">{u.identifier}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500">Registered</dt><dd className="font-medium">{u.created_at}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500">Name</dt><dd className="font-medium">{addresses[0]?.customer_name || "—"}</dd></div>
          </dl>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-brand-50 px-5 py-3"><p className="text-2xl font-extrabold text-brand-700">{orders.length}</p><p className="text-xs text-gray-500">Orders</p></div>
          <div className="rounded-xl bg-brand-50 px-5 py-3"><p className="text-2xl font-extrabold text-brand-700">{inr(spent)}</p><p className="text-xs text-gray-500">Total spent</p></div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-bold">Address details ({addresses.length})</h2>
        {addresses.length === 0 && <div className="card p-6 text-center text-sm text-gray-500">No address yet — this user hasn't placed an order.</div>}
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((a, n) => (
            <div key={n} className="card p-4">
              <p className="font-semibold">📍 {a.customer_name}</p>
              <address className="mt-1 text-sm not-italic leading-relaxed text-gray-700">
                {a.house_name}, {a.street_name}<br />{a.city}, {a.state} - {a.pincode}
              </address>
              <a href={`tel:${a.phone}`} className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">📞 {a.phone}</a>
              <p className="mt-1 text-xs text-gray-400">Used in {a.uses} order{a.uses > 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-bold">Order history</h2>
        {orders.length === 0 && <p className="text-sm text-gray-500">No orders.</p>}
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">Order #{o.id} <span className="ml-2 text-xs font-normal text-gray-500">{o.created_at}</span></p>
                <Items json={o.items} />
              </div>
              <div className="text-right">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor(o.status)}`}>{o.status}</span>
                <p className="mt-2 font-bold text-brand-700">{inr(o.total)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
