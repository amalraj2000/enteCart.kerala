import { db } from "@/lib/db";
import { withImages } from "@/lib/orderItems";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import { ORDER_STATUSES } from "@/lib/types";
import OrdersView from "./OrdersView";

export const dynamic = "force-dynamic";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && ORDER_STATUSES.includes(sp.status) ? sp.status : "All";
  const c = await db();

  const counts: Record<string, number> = { All: 0 };
  for (const r of (await c.execute("SELECT status, COUNT(*) AS n FROM orders GROUP BY status")).rows) {
    counts[String(r.status)] = Number(r.n);
    counts.All += Number(r.n);
  }
  const pi = pageInfo(counts[status] ?? 0, parsePage(sp.page));
  const rows = (await c.execute({
    sql: `SELECT * FROM orders ${status === "All" ? "" : "WHERE status = ?"} ORDER BY id DESC LIMIT ${PAGE_SIZE} OFFSET ?`,
    args: status === "All" ? [pi.offset] : [status, pi.offset],
  })).rows;
  return <OrdersView orders={await withImages(rows)} counts={counts} status={status} pi={pi} />;
}
