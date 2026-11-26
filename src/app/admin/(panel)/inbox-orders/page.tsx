import Link from "next/link";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import { buildInboxFilter, inboxEnabled } from "@/lib/inbox";
import InboxManager, { type InboxOrder, type PickProduct } from "./InboxManager";

export const dynamic = "force-dynamic";
const SORTS: Record<string, string> = { newest: "o.id DESC", oldest: "o.id ASC", date: "o.order_date DESC, o.id DESC", high: "o.total DESC, o.id DESC", low: "o.total ASC, o.id ASC" };

/** Owner only. Blocked (not just hidden) while the Inbox Orders switch in Settings is OFF — saved orders stay in the database. */
export default async function InboxOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSuperAdmin();
  const c = await db();
  if (!(await inboxEnabled(c))) {
    return (
      <div className="card max-w-xl space-y-3 p-6">
        <h1 className="text-xl font-bold">Inbox Orders is turned off</h1>
        <p className="text-sm text-gray-600">Your saved inbox orders are safe. Turn the feature back on in Settings to see and manage them again.</p>
        <Link href="/admin/settings" className="btn-primary inline-block">Open Settings</Link>
      </div>
    );
  }
  const sp = await searchParams;
  const { q, status, source, pay, from, to, where, args } = buildInboxFilter(sp);
  const sort = sp.sort && SORTS[sp.sort] ? sp.sort : "newest";

  const total = Number((await c.execute({ sql: `SELECT COUNT(*) n FROM inbox_orders o ${where}`, args })).rows[0].n);
  const pi = pageInfo(total, parsePage(sp.page));
  const rows = (await c.execute({ sql: `SELECT o.* FROM inbox_orders o ${where} ORDER BY ${SORTS[sort]} LIMIT ${PAGE_SIZE} OFFSET ?`, args: [...args, pi.offset] })).rows;
  const ids = rows.map((r) => Number(r.id));
  const marks = ids.map(() => "?").join(",");
  const items = ids.length ? (await c.execute({ sql: `SELECT * FROM inbox_order_items WHERE order_id IN (${marks}) ORDER BY id`, args: ids })).rows : [];
  const hist = ids.length ? (await c.execute({ sql: `SELECT * FROM inbox_order_history WHERE order_id IN (${marks}) ORDER BY id DESC`, args: ids })).rows : [];

  const orders: InboxOrder[] = rows.map((r) => ({
    id: Number(r.id), order_no: String(r.order_no), customer_name: String(r.customer_name), phone: String(r.phone), house_name: String(r.house_name), street_name: String(r.street_name),
    city: String(r.city), state: String(r.state), pincode: String(r.pincode), instructions: String(r.instructions), source: String(r.source), order_date: String(r.order_date),
    payment_method: String(r.payment_method), payment_status: String(r.payment_status), status: String(r.status), tracking_number: String(r.tracking_number), notes: String(r.notes),
    subtotal: Number(r.subtotal), delivery_charge: Number(r.delivery_charge), discount: Number(r.discount), total: Number(r.total), created_at: String(r.created_at), updated_at: String(r.updated_at),
    items: items.filter((i) => Number(i.order_id) === Number(r.id)).map((i) => ({ product_id: i.product_id == null ? null : Number(i.product_id), title: String(i.title), qty: Number(i.qty), price: Number(i.price), image_url: String(i.image_url) })),
    history: hist.filter((h) => Number(h.order_id) === Number(r.id)).map((h) => ({ event: String(h.event), actor: String(h.actor), created_at: String(h.created_at) })),
  }));

  // Summary over ALL saved inbox orders (not just this page / filter): one row per order, so nothing is counted twice.
  const s = (await c.execute("SELECT COUNT(*) n, COALESCE(SUM(status = 'Delivered'), 0) delivered FROM inbox_orders")).rows[0];
  const summary = { total: Number(s.n), delivered: Number(s.delivered) };

  const products: PickProduct[] = (await c.execute("SELECT id, title, price, image_url, stock FROM products WHERE status = 'active' ORDER BY title LIMIT 500")).rows
    .map((p) => ({ id: Number(p.id), title: String(p.title), price: Number(p.price), image_url: String(p.image_url || ""), stock: Number(p.stock) }));

  return <InboxManager orders={orders} pi={pi} summary={summary} products={products} filters={{ q, status, source, pay, from, to, sort }} />;
}
