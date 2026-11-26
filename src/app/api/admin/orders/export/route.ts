import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { bad } from "@/lib/http";
import { buildOrderFilter } from "@/lib/orderFilters";
import { csvResponse, toCsv } from "@/lib/csv";
import { istDay } from "@/lib/istDate";

export const dynamic = "force-dynamic";
const MAX_ROWS = 20000;
const chunk = <T,>(a: T[], n = 400) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** CSV of the orders the Orders list is showing (same status / date / search filters), website + inbox orders. Staff only. */
export async function GET(req: Request) {
  const me = await getAdmin();
  if (!me) return bad("Please log in", 401);
  const u = new URL(req.url).searchParams;
  const c = await db();
  const g = (k: string) => u.get(k) ?? undefined;
  const f = await buildOrderFilter(c, me.role, { status: g("status"), date: g("date"), month: g("month"), q: g("q"), from: g("from"), to: g("to"), type: g("type"), pay: g("pay") });
  const statusSql = f.status === "All" ? "" : "WHERE status = ?";
  const statusArgs = f.status === "All" ? [] : [f.status];
  if (u.get("count") === "1") { // the popup asks how many orders its filters match
    const n = Number((await c.execute({ sql: `SELECT COUNT(*) AS n FROM (${f.all}) ${statusSql}`, args: [...f.allArgs, ...statusArgs] })).rows[0].n);
    return Response.json({ count: n, max: MAX_ROWS });
  }
  const page = (await c.execute({
    sql: `SELECT k, id FROM (${f.all}) ${statusSql} ORDER BY created_at DESC, id DESC LIMIT ${MAX_ROWS}`,
    args: [...f.allArgs, ...statusArgs],
  })).rows.map((r) => ({ k: String(r.k), id: Number(r.id) }));
  const wIds = page.filter((r) => r.k === "w").map((r) => r.id), iIds = page.filter((r) => r.k === "i").map((r) => r.id);
  const owner = me.role === "admin"; // customer e-mail addresses only for the owner

  const web = new Map<number, unknown[]>();
  for (const ids of chunk(wIds)) {
    const m = ids.map(() => "?").join(",");
    for (const r of (await c.execute({
      sql: `SELECT o.*, u.email AS user_email, date(o.created_at, '+330 minutes') AS day,
              (SELECT group_concat(title || CASE WHEN size != '' THEN ' (' || size || ')' ELSE '' END || ' x' || qty, '; ') FROM order_items WHERE order_id = o.id) AS products,
              (SELECT COALESCE(SUM(qty), 0) FROM order_items WHERE order_id = o.id) AS qty
            FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.id IN (${m})`, args: ids,
    })).rows)
      web.set(Number(r.id), [r.order_no || `#${r.id}`, "Website", "Website", r.day, r.customer_name, r.phone, owner ? r.user_email : "", r.house_name, r.street_name, r.city, r.state, r.pincode,
        r.products, r.qty, 0, Number(r.discount || 0), r.total, r.payment_method === "online" ? "Online" : "Cash on Delivery", r.payment_status, r.status, "", ""]);
  }
  const inbox = new Map<number, unknown[]>();
  for (const ids of chunk(iIds)) {
    const m = ids.map(() => "?").join(",");
    for (const r of (await c.execute({
      sql: `SELECT o.*, (SELECT group_concat(title || ' x' || qty, '; ') FROM inbox_order_items WHERE order_id = o.id) AS products,
              (SELECT COALESCE(SUM(qty), 0) FROM inbox_order_items WHERE order_id = o.id) AS qty FROM inbox_orders o WHERE o.id IN (${m})`, args: ids,
    })).rows)
      inbox.set(Number(r.id), [r.order_no, "Inbox", r.source, r.order_date, r.customer_name, r.phone, "", r.house_name, r.street_name, r.city, r.state, r.pincode,
        r.products, r.qty, Number(r.delivery_charge), Number(r.discount), r.total, r.payment_method, r.payment_status, r.status, r.tracking_number, r.notes]);
  }
  const rows = page.map((r) => (r.k === "w" ? web.get(r.id) : inbox.get(r.id))).filter((x): x is unknown[] => !!x);
  const header = ["Order No", "Type", "Source", "Order Date", "Customer", "Phone", "Email", "House / Building", "Street / Locality", "City", "State", "PIN Code",
    "Products", "Total Qty", "Delivery Charge", "Discount", "Total (INR)", "Payment Method", "Payment Status", "Order Status", "Tracking Number", "Notes"];
  return csvResponse(toCsv(header, rows), `orders-${istDay()}.csv`);
}
