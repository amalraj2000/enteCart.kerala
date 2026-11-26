import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { editableOrderIds } from "@/lib/permissions";
import { withImages } from "@/lib/orderItems";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import { istDay, istMonth } from "@/lib/istDate";
import { buildOrderFilter } from "@/lib/orderFilters";
import OrdersView from "./OrdersView";

export const dynamic = "force-dynamic";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; date?: string; month?: string; q?: string }> }) {
  const sp = await searchParams;
  const me = await requireAdmin(); // the layout already guarantees staff
  const c = await db();
  const { status, q, today, range, where, dateArgs, withInbox, iWhere, iArgs, all, allArgs } = await buildOrderFilter(c, me.role, sp); // same filters as the CSV export

  const counts: Record<string, number> = { All: 0 };
  for (const r of (await c.execute({ sql: `SELECT status, COUNT(*) AS n FROM (${all}) GROUP BY status`, args: allArgs })).rows) {
    counts[String(r.status)] = Number(r.n);
    counts.All += Number(r.n);
  }
  // Money actually earned in this period: not cancelled, and online orders only once paid. (Inbox orders: not cancelled and not refunded.)
  let sales = Number((await c.execute({ sql: `SELECT COALESCE(SUM(total), 0) AS n FROM orders WHERE ${where} AND status != 'Cancelled' AND payment_status NOT IN ('Unpaid', 'Refunded')`, args: dateArgs })).rows[0].n);
  if (withInbox) sales += Number((await c.execute({ sql: `SELECT COALESCE(SUM(total), 0) AS n FROM inbox_orders WHERE ${iWhere} AND status != 'Cancelled' AND payment_status != 'Refunded'`, args: iArgs })).rows[0].n);
  const pi = pageInfo(counts[status] ?? 0, parsePage(sp.page));
  const page = (await c.execute({
    sql: `SELECT k, id FROM (${all}) ${status === "All" ? "" : "WHERE status = ?"} ORDER BY created_at DESC, id DESC LIMIT ${PAGE_SIZE} OFFSET ?`,
    args: [...allArgs, ...(status === "All" ? [] : [status]), pi.offset],
  })).rows.map((r) => ({ k: String(r.k), id: Number(r.id) }));
  const wIds = page.filter((r) => r.k === "w").map((r) => r.id), iIds = page.filter((r) => r.k === "i").map((r) => r.id);
  const wRows = wIds.length ? (await c.execute({ sql: `SELECT * FROM orders WHERE id IN (${wIds.map(() => "?").join(",")})`, args: wIds })).rows : [];
  const editable = await editableOrderIds(c, me, wIds); // sub admin: only orders containing their products
  const wOrders = new Map((await withImages(wRows, { admins: true })).map((o) => [Number(o.id), { ...o, kind: "web", editable: editable.has(Number(o.id)) }]));
  const iRows = iIds.length ? (await c.execute({ sql: `SELECT * FROM inbox_orders WHERE id IN (${iIds.map(() => "?").join(",")})`, args: iIds })).rows : [];
  const iItems = iIds.length ? (await c.execute({ sql: `SELECT order_id, title, qty, image_url FROM inbox_order_items WHERE order_id IN (${iIds.map(() => "?").join(",")}) ORDER BY id`, args: iIds })).rows : [];
  const iOrders = new Map(iRows.map((r) => [Number(r.id), {
    kind: "inbox", id: Number(r.id), order_no: String(r.order_no), customer_name: String(r.customer_name), phone: String(r.phone), source: String(r.source), status: String(r.status),
    payment_status: String(r.payment_status), payment_method: String(r.payment_method), total: Number(r.total), order_date: String(r.order_date), created_at: String(r.created_at),
    items: iItems.filter((i) => Number(i.order_id) === Number(r.id)).map((i) => ({ title: String(i.title), qty: Number(i.qty), image_url: String(i.image_url || "") })),
  }]));
  const orders = page.map((r) => (r.k === "w" ? wOrders.get(r.id) : iOrders.get(r.id))).filter((o) => !!o) as unknown as Parameters<typeof OrdersView>[0]["orders"];
  return <OrdersView orders={orders} counts={counts} status={status} pi={pi} scoped={me.role !== "admin"} range={range} q={q} hasInbox={withInbox} sales={sales} today={today} yesterday={istDay(-1)} thisMonth={istMonth()} />;
}
