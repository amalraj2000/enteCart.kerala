import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { editableOrderIds } from "@/lib/permissions";
import { withImages } from "@/lib/orderItems";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import { ORDER_STATUSES } from "@/lib/types";
import { istDay, istMonth, isMonth, isRealDay } from "@/lib/istDate";
import OrdersView from "./OrdersView";

export const dynamic = "force-dynamic";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; date?: string; month?: string; q?: string }> }) {
  const sp = await searchParams;
  const me = await requireAdmin(); // the layout already guarantees staff
  const status = typeof sp.status === "string" && ORDER_STATUSES.includes(sp.status) ? sp.status : "All";
  const c = await db();

  // Date filter (in IST). Nothing chosen = TODAY. ?date=2026-11-18 · ?month=2026-11 · ?date=all
  const today = istDay();
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : ""; // search by order no, customer name, phone or email — across ALL dates unless a date is chosen
  const range: { kind: "day" | "month" | "all"; value: string } =
    sp.date === "all" ? { kind: "all", value: "" }
    : typeof sp.month === "string" && isMonth(sp.month) ? { kind: "month", value: sp.month }
    : typeof sp.date === "string" && isRealDay(sp.date) ? { kind: "day", value: sp.date }
    : q ? { kind: "all", value: "" } : { kind: "day", value: today };
  const dateSql = range.kind === "all" ? "1=1" : range.kind === "day" ? "date(created_at, '+330 minutes') = ?" : "strftime('%Y-%m', created_at, '+330 minutes') = ?";
  const dateArgs: (string | number)[] = range.kind === "all" ? [] : [range.value];
  let searchSql = "1=1";
  if (q) {
    const l = `%${q.replace(/[%_]/g, "")}%`;
    searchSql = "(order_no LIKE ? OR customer_name LIKE ? OR phone LIKE ? OR user_id IN (SELECT id FROM users WHERE email LIKE ? OR name LIKE ?))";
    dateArgs.push(l, l, l, l, l);
  }
  const where = `${dateSql} AND ${searchSql}`;

  const counts: Record<string, number> = { All: 0 };
  for (const r of (await c.execute({ sql: `SELECT status, COUNT(*) AS n FROM orders WHERE ${where} GROUP BY status`, args: dateArgs })).rows) {
    counts[String(r.status)] = Number(r.n);
    counts.All += Number(r.n);
  }
  // Money actually earned in this period: not cancelled, and online orders only once paid.
  const sales = Number((await c.execute({ sql: `SELECT COALESCE(SUM(total), 0) AS n FROM orders WHERE ${where} AND status != 'Cancelled' AND payment_status NOT IN ('Unpaid', 'Refunded')`, args: dateArgs })).rows[0].n);
  const pi = pageInfo(counts[status] ?? 0, parsePage(sp.page));
  const rows = (await c.execute({
    sql: `SELECT * FROM orders WHERE ${where}${status === "All" ? "" : " AND status = ?"} ORDER BY id DESC LIMIT ${PAGE_SIZE} OFFSET ?`,
    args: [...dateArgs, ...(status === "All" ? [] : [status]), pi.offset],
  })).rows;
  const editable = await editableOrderIds(c, me, rows.map((r) => Number(r.id))); // sub admin: only orders containing their products
  const orders = (await withImages(rows, { admins: true })).map((o) => ({ ...o, editable: editable.has(Number(o.id)) }));
  return <OrdersView orders={orders} counts={counts} status={status} pi={pi} scoped={me.role !== "admin"} range={range} q={q} sales={sales} today={today} yesterday={istDay(-1)} thisMonth={istMonth()} />;
}
