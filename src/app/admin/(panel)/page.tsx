import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { parseId } from "@/lib/validate";
import { staffNameSql, welcomeName } from "@/lib/staffLabel";
import { inr } from "@/lib/types";
import { formatIst, istDay, istMonth } from "@/lib/istDate";
import { statusColor } from "@/components/OrderList";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

// Order items that belong to ONE admin's products (an order can mix products of several admins).
const ITEMS = "FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id WHERE p.created_by = ?";
const PAID = "o.status != 'Cancelled' AND o.payment_status NOT IN ('Unpaid','Refunded')";

function Tile({ label, value, sub, href, alert }: { label: string; value: string | number; sub?: string; href?: string; alert?: boolean }) {
  const body = (
    <>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold tracking-tight ${alert ? "text-red-600" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </>
  );
  return href
    ? <Link href={href} className="card block p-5 transition hover:border-brand-600">{body}</Link>
    : <div className="card p-5">{body}</div>;
}

/** A deliberately small dashboard: what needs doing today, this month's sales, recent orders and low stock. */
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ admin?: string }> }) {
  const sp = await searchParams;
  const me = await requireAdmin(); // the layout already guarantees staff
  const c = await db();
  const one = async (sql: string, args: (string | number)[] = []) => (await c.execute({ sql, args })).rows[0];
  const all = async (sql: string, args: (string | number)[] = []) => (await c.execute({ sql, args })).rows as unknown as Row[];

  const staff = me.role === "admin" ? ((await all(`SELECT id, ${staffNameSql("users")} AS name FROM users WHERE role IN ('admin', 'subadmin') ORDER BY (role = 'admin') DESC, id`)) as { id: number; name: string }[]) : [];
  // Sub admins ALWAYS see only their own products' numbers (the ?admin= value is ignored for them).
  // The super admin sees everything, or one admin's products when ?admin=<id> is chosen.
  const wanted = parseId(sp.admin);
  const scopeId: number | null = me.role === "subadmin" ? me.id : wanted && staff.some((x) => Number(x.id) === wanted) ? wanted : null;
  const scoped = scopeId !== null;
  const s = scopeId ?? 0;
  const today = istDay(), month = istMonth();

  let profit: Row, toProcess: Row, todayOrders: Row, revenue: Row, lowCount: Row, outCount: Row, pendingReviews: Row, recent: Row[], lowRows: Row[];
  // Profit = (selling price − Meesho cost snapshotted on the order line) × qty, only for lines whose cost was known (cost > 0).
  const PROFIT = `SELECT COALESCE(SUM(oi.qty * (oi.price - oi.cost)), 0) n ${ITEMS.replace("WHERE p.created_by = ?", "WHERE (? = 0 OR p.created_by = ?)")} AND oi.cost > 0 AND ${PAID} AND strftime('%Y-%m', o.created_at, '+330 minutes') = ?`;
  profit = await one(PROFIT, [s, s, month]);
  if (!scoped) {
    [toProcess, todayOrders, revenue, lowCount, outCount, pendingReviews, recent, lowRows] = await Promise.all([
      one("SELECT COUNT(*) n FROM orders WHERE status IN ('Placed','Confirmed')"),
      one("SELECT COUNT(*) n FROM orders WHERE date(created_at, '+330 minutes') = ?", [today]),
      one("SELECT COALESCE(SUM(total),0) n FROM orders WHERE status != 'Cancelled' AND payment_status NOT IN ('Unpaid','Refunded') AND strftime('%Y-%m', created_at, '+330 minutes') = ?", [month]),
      one("SELECT COUNT(*) n FROM products WHERE stock BETWEEN 1 AND 5"),
      one("SELECT COUNT(*) n FROM products WHERE stock = 0"),
      one("SELECT COUNT(*) n FROM reviews WHERE status = 'pending'"),
      all("SELECT id, customer_name, total, status, created_at FROM orders ORDER BY id DESC LIMIT 5"),
      all("SELECT id, title, stock FROM products WHERE stock <= 5 ORDER BY stock, title LIMIT 5"),
    ]);
  } else {
    [toProcess, todayOrders, revenue, lowCount, outCount, pendingReviews, recent, lowRows] = await Promise.all([
      one(`SELECT COUNT(DISTINCT o.id) n ${ITEMS} AND o.status IN ('Placed','Confirmed')`, [s]),
      one(`SELECT COUNT(DISTINCT o.id) n ${ITEMS} AND date(o.created_at, '+330 minutes') = ?`, [s, today]),
      one(`SELECT COALESCE(SUM(oi.qty * oi.price), 0) n ${ITEMS} AND ${PAID} AND strftime('%Y-%m', o.created_at, '+330 minutes') = ?`, [s, month]),
      one("SELECT COUNT(*) n FROM products WHERE created_by = ? AND stock BETWEEN 1 AND 5", [s]),
      one("SELECT COUNT(*) n FROM products WHERE created_by = ? AND stock = 0", [s]),
      one("SELECT COUNT(*) n FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.status = 'pending' AND p.created_by = ?", [s]),
      all(`SELECT o.id, o.customer_name, o.status, o.created_at, SUM(oi.qty * oi.price) AS total ${ITEMS} GROUP BY o.id ORDER BY o.id DESC LIMIT 5`, [s]),
      all("SELECT id, title, stock FROM products WHERE created_by = ? AND stock <= 5 ORDER BY stock, title LIMIT 5", [s]),
    ]);
  }
  const needStock = Number(lowCount.n) + Number(outCount.n);
  const waiting = Number(pendingReviews.n);
  const scopeName = staff.find((x) => Number(x.id) === scopeId)?.name ?? "";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm font-medium text-brand-700">Welcome, {welcomeName(me)} 👋</p>
        {scoped && <p className="text-sm text-gray-500">{me.role === "subadmin" ? "Showing the products you added." : <>Showing <b className="text-gray-700">{scopeName}</b>’s products.</>}</p>}
      </div>

      {/* Super admin: switch between everything and one admin's products */}
      {me.role === "admin" && staff.length > 1 && (
        <nav aria-label="Admin view" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
          <span className="shrink-0 text-sm text-gray-500">View:</span>
          {[{ id: null as number | null, name: "All" }, ...staff.map((x) => ({ id: Number(x.id), name: x.name }))].map((x) => (
            <Link key={x.id ?? "all"} href={x.id ? `/admin?admin=${x.id}` : "/admin"} className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${x.id === scopeId ? "border-brand-600 bg-brand-600 text-white" : "border-gray-300 bg-white hover:border-brand-600 hover:text-brand-700"}`}>{x.name}</Link>
          ))}
        </nav>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Tile label="Orders to process" value={Number(toProcess.n)} sub="Placed + Confirmed" href="/admin/orders" alert={Number(toProcess.n) > 0} />
        <Tile label="Orders today" value={Number(todayOrders.n)} />
        <Tile label="Revenue this month" value={inr(Number(revenue.n))} sub="excl. cancelled & unpaid" />
        <Tile label="Profit this month" value={inr(Number(profit.n))} sub="selling price − Meesho price" />
        <Tile label="Low stock" value={needStock} sub={needStock ? `${Number(outCount.n)} out of stock` : "All stocked up"} href="/admin/products" alert={Number(outCount.n) > 0} />
      </div>

      {waiting > 0 && (
        <Link href="/admin/reviews?f=Pending" className="card flex items-center justify-between gap-3 border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-900 hover:border-amber-400">
          <span>⭐ {waiting} review{waiting === 1 ? "" : "s"} waiting for approval</span><span aria-hidden>Review →</span>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="card overflow-x-auto p-5 lg:col-span-3">
          <h2 className="mb-3 font-bold">Recent orders</h2>
          {recent.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">No orders yet</p> : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-500"><tr><th className="pb-2">Order</th><th className="pb-2">Customer</th><th className="pb-2">Status</th><th className="pb-2 text-right">{scoped ? "Amount" : "Total"}</th></tr></thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={String(o.id)} className="border-t">
                    <td className="py-2"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">#{String(o.id)}</Link><p className="text-xs text-gray-400">{formatIst(o.created_at).split(",")[0]}</p></td>
                    <td className="py-2">{String(o.customer_name)}</td>
                    <td className="py-2"><span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(String(o.status))}`}>{String(o.status)}</span></td>
                    <td className="py-2 text-right font-semibold">{inr(Number(o.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link href="/admin/orders" className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">View all orders →</Link>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-bold">Stock alerts</h2>
          {lowRows.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">All products are well stocked 🎉</p> : (
            <ul className="divide-y text-sm">
              {lowRows.map((p) => (
                <li key={String(p.id)} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate">{String(p.title)}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${Number(p.stock) === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{Number(p.stock) === 0 ? "Out of stock" : `${p.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={scoped ? `/admin/products?by=${scopeId}` : "/admin/products"} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">Manage products →</Link>
        </section>
      </div>
    </div>
  );
}
