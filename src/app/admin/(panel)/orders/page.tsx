import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { editableOrderIds } from "@/lib/permissions";
import { withImages } from "@/lib/orderItems";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import { ORDER_STATUSES } from "@/lib/types";
import { istDay, istMonth, isMonth, isRealDay } from "@/lib/istDate";
import OrdersView from "./OrdersView";

export const dynamic = "force-dynamic";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; date?: string; month?: string }> }) {
  const sp = await searchParams;
  const me = (await getAdmin())!; // the layout already guarantees staff
  const status = typeof sp.status === "string" && ORDER_STATUSES.includes(sp.status) ? sp.status : "All";
  const c = await db();

  // Date filter (in IST). Nothing chosen = TODAY. ?date=2026-11-18 · ?month=2026-11 · ?date=all
  const today = istDay();
  const range: { kind: "day" | "month" | "all"; value: string } =
    sp.date === "all" ? { kind: "all", value: "" }
    : typeof sp.month === "string" && isMonth(sp.month) ? { kind: "month", value: sp.month }
    : typeof sp.date === "string" && isRealDay(sp.date) ? { kind: "day", value: sp.date }
    : { kind: "day", value: today };
  const dateSql = range.kind === "all" ? "1=1" : range.kind === "day" ? "date(created_at, '+330 minutes') = ?" : "strftime('%Y-%m', created_at, '+330 minutes') = ?";
  const dateArgs = range.kind === "all" ? [] : [range.value];

  const counts: Record<string, number> = { All: 0 };
  for (const r of (await c.execute({ sql: `SELECT status, COUNT(*) AS n FROM orders WHERE ${dateSql} GROUP BY status`, args: dateArgs })).rows) {
    counts[String(r.status)] = Number(r.n);
    counts.All += Number(r.n);
  }
  // Money actually earned in this period: not cancelled, and online orders only once paid.
  const sales = Number((await c.execute({ sql: `SELECT COALESCE(SUM(total), 0) AS n FROM orders WHERE ${dateSql} AND status != 'Cancelled' AND payment_status NOT IN ('Unpaid', 'Refunded')`, args: dateArgs })).rows[0].n);
  const pi = pageInfo(counts[status] ?? 0, parsePage(sp.page));
  const rows = (await c.execute({
    sql: `SELECT * FROM orders WHERE ${dateSql}${status === "All" ? "" : " AND status = ?"} ORDER BY id DESC LIMIT ${PAGE_SIZE} OFFSET ?`,
    args: [...dateArgs, ...(status === "All" ? [] : [status]), pi.offset],
  })).rows;
  const editable = await editableOrderIds(c, me, rows.map((r) => Number(r.id))); // sub admin: only orders containing their products
  const orders = (await withImages(rows, { admins: true })).map((o) => ({ ...o, editable: editable.has(Number(o.id)) }));
  return <OrdersView orders={orders} counts={counts} status={status} pi={pi} scoped={me.role !== "admin"} range={range} sales={sales} today={today} yesterday={istDay(-1)} thisMonth={istMonth()} />;
}
