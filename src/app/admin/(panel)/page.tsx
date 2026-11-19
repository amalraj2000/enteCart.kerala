import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { parseId } from "@/lib/validate";
import { staffNameSql, welcomeName } from "@/lib/staffLabel";
import { inr } from "@/lib/types";
import { statusColor } from "@/components/OrderList";
import { BarList, Donut, TimeSeries, type Point } from "@/components/Charts";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90];
const ORDER_STATUS_COLORS: Record<string, string> = { Placed: "var(--cat-1)", Confirmed: "var(--cat-2)", Shipped: "var(--cat-3)", Delivered: "var(--cat-4)", Cancelled: "var(--cat-5)" };

/** Dates are bucketed in IST (the shop's timezone), not UTC. */
const istDay = (offsetDays = 0) => new Date(Date.now() + 330 * 60_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
const IST = "date(created_at, '+330 minutes')";

function series(rows: Record<string, unknown>[], days: number, key = "n"): Point[] {
  const by = new Map(rows.map((r) => [String(r.d), Number(r[key]) || 0]));
  return Array.from({ length: days }, (_, k) => { const d = istDay(k - days + 1); return { date: d, value: by.get(d) ?? 0 }; });
}
function delta(cur: number, prev: number, days: number) {
  if (!prev) return cur ? { text: "new this period", up: true } : { text: `vs previous ${days} days`, up: null as boolean | null };
  const p = Math.round(((cur - prev) / prev) * 100);
  return { text: `${p >= 0 ? "▲ +" : "▼ "}${p}% vs previous ${days} days`, up: p >= 0 };
}

function Tile({ icon, label, value, sub, tone }: { icon: string; label: string; value: string | number; sub?: string; tone?: boolean | null }) {
  return (
    <div className="card p-5">
      <p className="flex items-center gap-2 text-sm text-gray-500"><span aria-hidden>{icon}</span>{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs" style={{ color: tone === true ? "var(--delta-good)" : tone === false ? "var(--delta-bad)" : "var(--text-secondary)" }}>{sub}</p>}
    </div>
  );
}
const Panel = ({ title, hint, children, className = "" }: { title: string; hint?: string; children: React.ReactNode; className?: string }) => (
  <section className={`card viz-root p-5 ${className}`}>
    <h2 className="font-bold">{title}</h2>
    {hint && <p className="mb-3 text-xs text-gray-500">{hint}</p>}
    {!hint && <div className="mb-3" />}
    {children}
  </section>
);

type Row = Record<string, unknown>;

// Order items that belong to ONE admin's products (an order can mix products of several admins).
const ITEMS = "FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id WHERE p.created_by = ?";
const OIST = "date(o.created_at, '+330 minutes')";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string; admin?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.range)) ? Number(sp.range) : 30;
  const start = istDay(-days + 1), prevStart = istDay(-2 * days + 1);
  const me = await requireAdmin(); // the layout already guarantees staff
  const c = await db();
  const one = async (sql: string, args: (string | number)[] = []) => (await c.execute({ sql, args })).rows[0];
  const all = async (sql: string, args: (string | number)[] = []) => (await c.execute({ sql, args })).rows as unknown as Row[];

  const staff = (await all(`SELECT id, ${staffNameSql("users")} AS name, role FROM users WHERE role IN ('admin', 'subadmin') ORDER BY (role = 'admin') DESC, id`)) as { id: number; name: string; role: string }[];
  // Sub admins ALWAYS see only their own products' numbers (the ?admin= value is ignored for them).
  // The super admin sees everything, or one admin's products when ?admin=<id> is chosen.
  const wanted = parseId(sp.admin);
  const scopeId: number | null = me.role === "subadmin" ? me.id : wanted && staff.some((x) => Number(x.id) === wanted) ? wanted : null;
  const scoped = scopeId !== null;
  const scopeName = staff.find((x) => Number(x.id) === scopeId)?.name ?? "";
  const s = scopeId ?? 0;

  let products: Row, outOfStock: Row, lowStock: Row, orders: Row, revenue: Row, pending: Row, units: Row = { n: 0 }, users: Row = { n: 0 }, aovRow: Row = { n: 0 };
  let oCur: Row, oPrev: Row, uCur: Row = { n: 0 }, uPrev: Row = { n: 0 };
  let ordersDaily: Row[], usersDaily: Row[] = [], orderStatus: Row[], userStatus: Row[] = [], perCategory: Row[], stockRows: Row[], recent: Row[], topRows: Row[];
  let adminRows: Row[] = [];

  if (!scoped) {
    [users, products, orders, revenue, outOfStock, lowStock, pending] = await Promise.all([
      one("SELECT COUNT(*) n FROM users WHERE role = 'user'"), one("SELECT COUNT(*) n FROM products"), one("SELECT COUNT(*) n FROM orders"),
      one("SELECT COALESCE(SUM(total),0) n FROM orders WHERE status != 'Cancelled' AND payment_status NOT IN ('Unpaid','Refunded')"),
      one("SELECT COUNT(*) n FROM products WHERE stock = 0"), one("SELECT COUNT(*) n FROM products WHERE stock BETWEEN 1 AND 5"),
      one("SELECT COUNT(*) n FROM orders WHERE status IN ('Placed','Confirmed')"),
    ]);
    const inRange = async (table: string, from: string, to: string, extra = table === "users" ? "AND role = 'user'" : "") =>
      one(`SELECT COUNT(*) n, COALESCE(SUM(${table === "orders" ? "CASE WHEN status != 'Cancelled' AND payment_status NOT IN ('Unpaid','Refunded') THEN total ELSE 0 END" : "0"}),0) rev FROM ${table} WHERE ${IST} >= ? AND ${IST} < ? ${extra}`, [from, to]);
    [oCur, oPrev, uCur, uPrev] = await Promise.all([inRange("orders", start, istDay(1)), inRange("orders", prevStart, start), inRange("users", start, istDay(1)), inRange("users", prevStart, start)]);
    [ordersDaily, usersDaily, orderStatus, userStatus, perCategory, stockRows, recent, topRows, adminRows] = await Promise.all([
      all(`SELECT ${IST} d, COUNT(*) n, COALESCE(SUM(CASE WHEN status != 'Cancelled' AND payment_status NOT IN ('Unpaid','Refunded') THEN total ELSE 0 END),0) rev FROM orders WHERE ${IST} >= ? GROUP BY d`, [start]),
      all(`SELECT ${IST} d, COUNT(*) n FROM users WHERE role = 'user' AND ${IST} >= ? GROUP BY d`, [start]),
      all("SELECT status, COUNT(*) n FROM orders GROUP BY status"),
      all("SELECT status, COUNT(*) n FROM users WHERE role = 'user' GROUP BY status"),
      all("SELECT COALESCE(c.name, 'Uncategorised') name, COUNT(p.id) n FROM products p LEFT JOIN categories c ON c.id = p.category_id GROUP BY c.id ORDER BY n DESC, name LIMIT 8"),
      all("SELECT id, title, stock FROM products WHERE stock <= 5 ORDER BY stock, title LIMIT 8"),
      all("SELECT id, customer_name, total, status, created_at FROM orders ORDER BY id DESC LIMIT 5"),
      all("SELECT oi.title, SUM(oi.qty) AS units, SUM(oi.qty * oi.price) AS rev FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status != 'Cancelled' GROUP BY COALESCE(oi.product_id, oi.title), oi.title ORDER BY units DESC LIMIT 5"),
      me.role === "admin" ? all(`SELECT u.id, ${staffNameSql("u")} AS name, u.role,
          (SELECT COUNT(*) FROM products WHERE created_by = u.id) AS products,
          (SELECT COUNT(DISTINCT o.id) FROM order_items oi JOIN products p ON p.id = oi.product_id JOIN orders o ON o.id = oi.order_id WHERE p.created_by = u.id) AS orders,
          (SELECT COALESCE(SUM(oi.qty), 0) FROM order_items oi JOIN products p ON p.id = oi.product_id JOIN orders o ON o.id = oi.order_id WHERE p.created_by = u.id AND o.status != 'Cancelled') AS units,
          (SELECT COALESCE(SUM(oi.qty * oi.price), 0) FROM order_items oi JOIN products p ON p.id = oi.product_id JOIN orders o ON o.id = oi.order_id WHERE p.created_by = u.id AND o.status != 'Cancelled') AS revenue
        FROM users u WHERE u.role IN ('admin', 'subadmin') ORDER BY revenue DESC, u.id`) : Promise.resolve([]),
    ]);
    aovRow = { n: Number(orders.n) - Number(orderStatus.find((r) => r.status === "Cancelled")?.n ?? 0) };
  } else {
    [products, outOfStock, lowStock, orders, revenue, units, pending, aovRow] = await Promise.all([
      one("SELECT COUNT(*) n FROM products WHERE created_by = ?", [s]),
      one("SELECT COUNT(*) n FROM products WHERE created_by = ? AND stock = 0", [s]),
      one("SELECT COUNT(*) n FROM products WHERE created_by = ? AND stock BETWEEN 1 AND 5", [s]),
      one(`SELECT COUNT(DISTINCT o.id) n ${ITEMS}`, [s]),
      one(`SELECT COALESCE(SUM(oi.qty * oi.price), 0) n ${ITEMS} AND o.status != 'Cancelled'`, [s]),
      one(`SELECT COALESCE(SUM(oi.qty), 0) n ${ITEMS} AND o.status != 'Cancelled'`, [s]),
      one(`SELECT COUNT(DISTINCT o.id) n ${ITEMS} AND o.status IN ('Placed', 'Confirmed')`, [s]),
      one(`SELECT COUNT(DISTINCT o.id) n ${ITEMS} AND o.status != 'Cancelled'`, [s]),
    ]);
    const range = (from: string, to: string) => one(`SELECT COUNT(DISTINCT o.id) n, COALESCE(SUM(CASE WHEN o.status != 'Cancelled' THEN oi.qty * oi.price ELSE 0 END), 0) rev ${ITEMS} AND ${OIST} >= ? AND ${OIST} < ?`, [s, from, to]);
    [oCur, oPrev] = await Promise.all([range(start, istDay(1)), range(prevStart, start)]);
    [ordersDaily, orderStatus, perCategory, stockRows, recent, topRows] = await Promise.all([
      all(`SELECT ${OIST} d, COUNT(DISTINCT o.id) n, COALESCE(SUM(CASE WHEN o.status != 'Cancelled' THEN oi.qty * oi.price ELSE 0 END), 0) rev ${ITEMS} AND ${OIST} >= ? GROUP BY d`, [s, start]),
      all(`SELECT o.status AS status, COUNT(DISTINCT o.id) n ${ITEMS} GROUP BY o.status`, [s]),
      all("SELECT COALESCE(c.name, 'Uncategorised') name, COUNT(p.id) n FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.created_by = ? GROUP BY c.id ORDER BY n DESC, name LIMIT 8", [s]),
      all("SELECT id, title, stock FROM products WHERE created_by = ? AND stock <= 5 ORDER BY stock, title LIMIT 8", [s]),
      all(`SELECT o.id, o.customer_name, o.status, o.created_at, SUM(oi.qty * oi.price) AS total ${ITEMS} GROUP BY o.id ORDER BY o.id DESC LIMIT 5`, [s]),
      all(`SELECT oi.title, SUM(oi.qty) AS units, SUM(oi.qty * oi.price) AS rev ${ITEMS} AND o.status != 'Cancelled' GROUP BY oi.product_id, oi.title ORDER BY units DESC LIMIT 5`, [s]),
    ]);
  }

  const top = topRows.map((r) => ({ label: String(r.title), value: Number(r.units), sub: `${inr(Number(r.rev))} revenue` }));
  const count = (rows: Row[], key: string) => Number(rows.find((r) => r.status === key)?.n ?? 0);
  const oc = Number(oCur.n), op = Number(oPrev.n), rc = Number(oCur.rev), rp = Number(oPrev.rev), uc = Number(uCur.n), up = Number(uPrev.n);
  const dOrders = delta(oc, op, days), dRev = delta(rc, rp, days), dUsers = delta(uc, up, days);
  const nonCancelled = Number(aovRow.n);
  const aov = nonCancelled > 0 ? Math.round(Number(revenue.n) / nonCancelled) : 0;
  const href = (adminId: number | null, r = days) => `/admin?${new URLSearchParams({ ...(adminId ? { admin: String(adminId) } : {}), ...(r !== 30 ? { range: String(r) } : {}) })}`;
  const who = me.role === "subadmin" ? "your products" : `${scopeName}’s products`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm font-medium text-brand-700">Welcome, {welcomeName(me)} 👋</p>
          {scoped && (
            <p className="text-sm text-gray-500">
              {me.role === "subadmin" ? "Orders and statistics for the products you added." : <>Showing orders and statistics for <b className="text-gray-700">{who}</b>.</>}
            </p>
          )}
        </div>
        <div className="flex gap-1 rounded-full border bg-white p-1 text-sm" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <Link key={r} href={href(me.role === "admin" ? scopeId : null, r)} className={`rounded-full px-3 py-1 font-medium ${r === days ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-brand-50"}`}>{r} days</Link>
          ))}
        </div>
      </div>

      {/* Super admin: switch between everything and one admin's products */}
      {me.role === "admin" && staff.length > 1 && (
        <nav aria-label="Admin view" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
          <span className="shrink-0 text-sm text-gray-500">View:</span>
          {[{ id: null as number | null, name: "All admins" }, ...staff.map((x) => ({ id: Number(x.id), name: x.name }))].map((x) => {
            const on = x.id === scopeId;
            return (
              <Link key={x.id ?? "all"} href={href(x.id)} className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${on ? "border-brand-600 bg-brand-600 text-white" : "border-gray-300 bg-white hover:border-brand-600 hover:text-brand-700"}`}>
                {x.name}
              </Link>
            );
          })}
        </nav>
      )}

      {!scoped ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Tile icon="👥" label="Total users" value={Number(users.n)} sub={`+${uc} new · ${dUsers.text}`} tone={dUsers.up} />
          <Tile icon="📦" label="Total products" value={Number(products.n)} sub={`${Number(outOfStock.n)} out of stock · ${Number(lowStock.n)} low`} tone={Number(outOfStock.n) ? false : null} />
          <Tile icon="🧾" label="Placed orders" value={Number(orders.n)} sub={`${oc} in period · ${dOrders.text}`} tone={dOrders.up} />
          <Tile icon="💰" label="Revenue (excl. cancelled)" value={inr(Number(revenue.n))} sub={`${inr(rc)} in period · ${dRev.text}`} tone={dRev.up} />
          <Tile icon="🧮" label="Average order value" value={inr(aov)} sub="across non-cancelled orders" />
          <Tile icon="⏳" label="Orders to process" value={Number(pending.n)} sub="Placed + Confirmed" tone={Number(pending.n) ? false : null} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Tile icon="📦" label={me.role === "subadmin" ? "My products" : "Products added"} value={Number(products.n)} sub={`${Number(outOfStock.n)} out of stock · ${Number(lowStock.n)} low`} tone={Number(outOfStock.n) ? false : null} />
          <Tile icon="🧾" label="Orders with these products" value={Number(orders.n)} sub={`${oc} in period · ${dOrders.text}`} tone={dOrders.up} />
          <Tile icon="💰" label="Revenue from these products" value={inr(Number(revenue.n))} sub={`${inr(rc)} in period · ${dRev.text}`} tone={dRev.up} />
          <Tile icon="🛍️" label="Units sold" value={Number(units.n)} sub="excl. cancelled orders" />
          <Tile icon="🧮" label="Average order value" value={inr(aov)} sub="of these products per order" />
          <Tile icon="⏳" label="Orders to process" value={Number(pending.n)} sub="Placed + Confirmed" tone={Number(pending.n) ? false : null} />
        </div>
      )}

      {/* Super admin, all-admins view: who added what, and how it sells */}
      {!scoped && me.role === "admin" && adminRows.length > 0 && (
        <Panel title="Admins overview" hint="Products each admin added and how they are selling (excludes cancelled orders)" className="!p-0">
          <ul className="divide-y md:hidden">
            {adminRows.map((a) => (
              <li key={String(a.id)} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{String(a.name)} <span className="ml-1 text-xs font-normal text-gray-400">{a.role === "admin" ? "Super admin" : "Sub admin"}</span></p>
                  <Link href={href(Number(a.id))} className="shrink-0 text-sm font-semibold text-brand-700">View →</Link>
                </div>
                <dl className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                  {[["Products", Number(a.products)], ["Orders", Number(a.orders)], ["Units", Number(a.units)], ["Revenue", inr(Number(a.revenue))]].map(([k, v]) => (
                    <div key={String(k)} className="rounded-lg bg-brand-50 px-1 py-2"><dd className="font-bold text-brand-700">{v}</dd><dt className="text-gray-500">{k}</dt></div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="bg-brand-50 text-xs text-gray-500"><tr><th className="px-5 py-2">Admin</th><th className="px-3 py-2">Role</th><th className="px-3 py-2 text-right">Products</th><th className="px-3 py-2 text-right">Orders</th><th className="px-3 py-2 text-right">Units sold</th><th className="px-3 py-2 text-right">Revenue</th><th className="px-5 py-2" /></tr></thead>
            <tbody>
              {adminRows.map((a) => (
                <tr key={String(a.id)} className="border-t">
                  <td className="px-5 py-2.5 font-medium">{String(a.name)}</td>
                  <td className="px-3 py-2.5 text-gray-500">{a.role === "admin" ? "Super admin" : "Sub admin"}</td>
                  <td className="px-3 py-2.5 text-right">{Number(a.products)}</td>
                  <td className="px-3 py-2.5 text-right">{Number(a.orders)}</td>
                  <td className="px-3 py-2.5 text-right">{Number(a.units)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{inr(Number(a.revenue))}</td>
                  <td className="px-5 py-2.5 text-right"><Link href={href(Number(a.id))} className="font-semibold text-brand-700 hover:underline">View dashboard →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Orders per day" hint={`Last ${days} days${scoped ? " · orders containing these products" : ""}`}><TimeSeries name="Orders" data={series(ordersDaily, days)} fmt={{ singular: "order" }} /></Panel>
        <Panel title="Revenue per day" hint={`Last ${days} days · excludes cancelled orders`}><TimeSeries name="Revenue" data={series(ordersDaily, days, "rev")} fmt={{ money: true }} /></Panel>
        {!scoped && <Panel title="New users per day" hint={`Last ${days} days`}><TimeSeries name="New users" data={series(usersDaily, days)} fmt={{ singular: "new user" }} /></Panel>}
        <Panel title="Orders by status" hint={scoped ? "All time · orders containing these products" : "All time"}>
          <Donut centerLabel="orders" slices={["Placed", "Confirmed", "Shipped", "Delivered", "Cancelled"].map((st) => ({ label: st, value: count(orderStatus, st), color: ORDER_STATUS_COLORS[st] }))} />
        </Panel>
        {!scoped && (
          <Panel title="Users by status" hint="All time">
            <Donut centerLabel="users" slices={[
              { label: "Active", value: count(userStatus, "active"), color: "var(--state-good)" },
              { label: "Inactive", value: count(userStatus, "inactive"), color: "var(--state-neutral)" },
              { label: "Blocked", value: count(userStatus, "blocked"), color: "var(--state-critical)" },
            ]} />
          </Panel>
        )}
        <Panel title="Products per category" hint="Top 8 categories"><BarList bars={perCategory.map((r) => ({ label: String(r.name), value: Number(r.n) }))} fmt={{}} /></Panel>
        <Panel title="Top selling products" hint="Units sold, all time (excludes cancelled)"><BarList bars={top} fmt={{ suffix: " sold" }} empty="No sales yet" /></Panel>
        <Panel title="Stock alerts" hint="Products with 5 or fewer in stock">
          {stockRows.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">All products are well stocked 🎉</p> : (
            <ul className="divide-y text-sm">
              {stockRows.map((p) => (
                <li key={String(p.id)} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate">{String(p.title)}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${Number(p.stock) === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{Number(p.stock) === 0 ? "Out of stock" : `${p.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={scoped ? `/admin/products?by=${scopeId}` : "/admin/products"} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">Manage products →</Link>
        </Panel>
      </div>

      <Panel title="Recent orders" hint={scoped ? "Orders containing these products — the amount is the share for these products" : undefined} className="overflow-x-auto">
        {recent.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">No orders yet</p> : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-500"><tr><th className="pb-2">Order</th><th className="pb-2">Customer</th><th className="hidden pb-2 sm:table-cell">Date</th><th className="pb-2">Status</th><th className="pb-2 text-right">{scoped ? "Amount" : "Total"}</th></tr></thead>
            <tbody>
              {recent.map((o) => (
                <tr key={String(o.id)} className="border-t">
                  <td className="py-2"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">#{String(o.id)}</Link></td>
                  <td className="py-2">{String(o.customer_name)}</td>
                  <td className="hidden py-2 text-gray-500 sm:table-cell">{String(o.created_at)}</td>
                  <td className="py-2"><span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(String(o.status))}`}>{String(o.status)}</span></td>
                  <td className="py-2 text-right font-semibold">{inr(Number(o.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Link href="/admin/orders" className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">View all orders →</Link>
      </Panel>
    </div>
  );
}
