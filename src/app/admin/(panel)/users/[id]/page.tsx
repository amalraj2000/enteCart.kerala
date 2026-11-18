import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { inr } from "@/lib/types";
import { statusColor } from "@/components/OrderList";
import { withImages } from "@/lib/orderItems";

const badge: Record<string, string> = { active: "bg-green-100 text-green-800", inactive: "bg-gray-200 text-gray-700", blocked: "bg-red-100 text-red-700" };

export const dynamic = "force-dynamic";

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db();
  const u = (await c.execute({ sql: "SELECT id, name, email, phone, status, role, avatar, address_id, created_at FROM users WHERE id = ?", args: [Number(id) || 0] })).rows[0] as any;
  if (!u) notFound();
  const orders = await withImages((await c.execute({ sql: "SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC", args: [u.id] })).rows);

  // Addresses: the saved one (addresses table) first, then any other address used on an order.
  const saved = (await c.execute({ sql: "SELECT * FROM addresses WHERE user_id = ? ORDER BY (id = ?) DESC, id", args: [u.id, u.address_id ?? 0] })).rows as any[];
  const addresses: { name: string; phone: string; line: string; city: string; pin: string; note: string }[] = saved.map((a) => ({ name: a.full_name, phone: a.phone, line: `${a.house_name}, ${a.street_name}`, city: `${a.city}, ${a.state}`, pin: a.pincode, note: a.id === u.address_id ? "Saved address" : "Address" }));
  const seen = new Set(saved.map((a) => [a.full_name, a.phone, a.house_name, a.street_name, a.city, a.state, a.pincode].join("|").toLowerCase()));
  for (const o of orders) {
    const k = [o.customer_name, o.phone, o.house_name, o.street_name, o.city, o.state, o.pincode].join("|").toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    addresses.push({ name: o.customer_name, phone: o.phone, line: `${o.house_name}, ${o.street_name}`, city: `${o.city}, ${o.state}`, pin: o.pincode, note: "Used on an order" });
  }
  const spent = orders.filter((o) => o.status !== "Cancelled").reduce((s, o) => s + Number(o.total), 0);
  const title = u.name || u.email || u.phone;

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-sm font-medium text-brand-700 hover:underline">← Back to users</Link>

      <section className="card flex flex-wrap items-center gap-5 p-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-3xl font-bold text-white ring-4 ring-brand-100">{u.avatar ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={u.avatar} alt="" className="h-full w-full rounded-full object-cover" /> : String(title)[0].toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="break-all text-xl font-bold">{title}</h1>
            {u.role === "admin" ? <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Admin</span> : <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badge[u.status]}`}>{u.status}</span>}
          </div>
          <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2"><dt className="text-gray-500">User ID</dt><dd className="font-medium">#{u.id}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500">Name</dt><dd className="font-medium">{u.name || "—"}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500">Email</dt><dd className="font-medium break-all">{u.email || "—"}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500">Phone</dt><dd className="font-medium">{u.phone || "—"}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500">Registered</dt><dd className="font-medium">{u.created_at}</dd></div>
          </dl>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-brand-50 px-5 py-3"><p className="text-2xl font-extrabold text-brand-700">{orders.length}</p><p className="text-xs text-gray-500">Orders</p></div>
          <div className="rounded-xl bg-brand-50 px-5 py-3"><p className="text-2xl font-extrabold text-brand-700">{inr(spent)}</p><p className="text-xs text-gray-500">Total spent</p></div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-bold">Address details ({addresses.length})</h2>
        {addresses.length === 0 && <div className="card p-6 text-center text-sm text-gray-500">No address saved yet.</div>}
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((a, n) => (
            <div key={n} className="card p-4">
              <p className="font-semibold">📍 {a.name}</p>
              <address className="mt-1 text-sm not-italic leading-relaxed text-gray-700">
                {a.line}<br />{a.city} - {a.pin}
              </address>
              <a href={`tel:${a.phone}`} className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">📞 {a.phone}</a>
              <p className="mt-1 text-xs text-gray-400">{a.note}</p>
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
                <ul className="text-sm text-gray-700">
                  {o.items.map((i, n) => <li key={n}>{i.title}{i.size && ` (${i.size})`} × {i.qty} — {inr(i.price * i.qty)}</li>)}
                </ul>
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
