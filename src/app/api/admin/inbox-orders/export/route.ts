import { buildInboxFilter } from "@/lib/inbox";
import { csvResponse, toCsv } from "@/lib/csv";
import { istDay } from "@/lib/istDate";
import { inboxGuard } from "../guard";

export const dynamic = "force-dynamic";

/** CSV of the inbox orders the Inbox Orders list is showing (same filters). Owner only, and only while Inbox Orders is ON. */
export async function GET(req: Request) {
  const g = await inboxGuard(); if ("error" in g) return g.error;
  const sp = Object.fromEntries(new URL(req.url).searchParams) as Record<string, string>;
  const f = buildInboxFilter(sp);
  const rows = (await g.c.execute({
    sql: `SELECT o.*, (SELECT group_concat(title || ' x' || qty, '; ') FROM inbox_order_items WHERE order_id = o.id) AS products,
            (SELECT COALESCE(SUM(qty), 0) FROM inbox_order_items WHERE order_id = o.id) AS qty FROM inbox_orders o ${f.where} ORDER BY o.id DESC LIMIT 20000`, args: f.args,
  })).rows.map((r) => [r.order_no, r.source, r.order_date, r.customer_name, r.phone, r.house_name, r.street_name, r.city, r.state, r.pincode, r.instructions, r.products, r.qty,
    r.delivery_charge, r.discount, r.total, r.payment_method, r.payment_status, r.status, r.tracking_number, r.notes, r.created_at]);
  return csvResponse(toCsv(["Order No", "Source", "Order Date", "Customer", "Phone", "House / Building", "Street / Locality", "City", "State", "PIN Code", "Delivery Instructions", "Products", "Total Qty",
    "Delivery Charge", "Discount", "Total (INR)", "Payment Method", "Payment Status", "Order Status", "Tracking Number", "Notes", "Created (UTC)"], rows), `inbox-orders-${istDay()}.csv`);
}
