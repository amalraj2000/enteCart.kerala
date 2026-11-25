import type { Client } from "@libsql/client";
import { inr } from "./types";
import { customerNameSql } from "./userName";
import { sendPush } from "./push";

export type NotifyInput = { type: "order" | "review"; title: string; body: string; link: string };
const KEEP = 50; // newest notifications kept per customer

/**
 * Adds an in-app notification for a customer. Best effort: it NEVER throws, so a notification problem can't break the
 * order or review action that triggered it. `link` must be an internal path (starts with a single "/").
 */
export async function notifyUser(c: Client, userId: number | null | undefined, n: NotifyInput): Promise<void> {
  if (!userId || !n.link.startsWith("/") || n.link.startsWith("//")) return;
  try {
    await c.execute({ sql: "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)", args: [userId, n.type, n.title.slice(0, 120), n.body.slice(0, 300), n.link] });
    await sendPush(c, userId, { title: n.title, body: n.body, url: n.link, tag: `${n.type}-${n.link}` }); // phone notification (never throws)
    if (Math.random() < 0.1) // now and then, drop everything older than the newest KEEP
      await c.execute({ sql: "DELETE FROM notifications WHERE user_id = ? AND id NOT IN (SELECT id FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?)", args: [userId, userId, KEEP] });
  } catch (e) { console.error("Notification failed:", (e as Error).message); }
}

/** What the customer is told when the shop moves their order to a new status. */
export function orderStatusNotice(orderId: number, status: string): { title: string; body: string } | null {
  switch (status) {
    case "Confirmed": return { title: `Order #${orderId} confirmed`, body: "We have confirmed your order and are getting it ready." };
    case "Shipped": return { title: `Order #${orderId} shipped`, body: "Your order is on its way to you." };
    case "Delivered": return { title: `Order #${orderId} delivered`, body: "Your order has been delivered. You can now rate and review your products." };
    case "Cancelled": return { title: `Order #${orderId} cancelled`, body: "Your order was cancelled by the shop. If you paid online, your refund will be processed to the original payment method." };
    case "Placed": return { title: `Order #${orderId} re-opened`, body: "Your cancelled order has been re-opened." };
    default: return null;
  }
}

/** Everything needed to word and link a review notification (read BEFORE the review is changed or deleted). */
export async function reviewInfo(c: Client, id: number) {
  const r = (await c.execute({
    sql: `SELECT r.user_id, r.status, r.active, p.title, p.public_id AS product_pid, o.public_id AS order_pid, o.id AS order_id
          FROM reviews r LEFT JOIN products p ON p.id = r.product_id LEFT JOIN orders o ON o.id = r.order_id WHERE r.id = ?`,
    args: [id],
  })).rows[0];
  if (!r) return null;
  const title = r.title ? String(r.title) : "a product";
  const orderLink = r.order_id ? `/orders/${r.order_pid || r.order_id}` : "/orders";
  return { userId: Number(r.user_id), status: String(r.status), active: Number(r.active) === 1, title, orderLink, productLink: r.product_pid ? `/product/${r.product_pid}#reviews` : orderLink };
}

// ---------- reading / marking (shared by the customer and the admin bell) ----------

export async function listNotifications(c: Client, userId: number) {
  const [unread, items] = await Promise.all([
    c.execute({ sql: "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0", args: [userId] }),
    c.execute({ sql: "SELECT id, type, title, body, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 20", args: [userId] }),
  ]);
  return {
    unread: Number(unread.rows[0].n),
    items: items.rows.map((r) => ({ id: Number(r.id), type: String(r.type), title: String(r.title), body: String(r.body), link: String(r.link), read: Number(r.is_read) === 1, created_at: String(r.created_at) })),
  };
}

/** { all: true } or { id }. Only ever touches the caller's own rows. Returns false for a malformed body. */
export async function markNotifications(c: Client, userId: number, b: Record<string, unknown>): Promise<boolean> {
  if (b.all === true) await c.execute({ sql: "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", args: [userId] });
  else if (typeof b.id === "number" && Number.isInteger(b.id) && b.id > 0) await c.execute({ sql: "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", args: [b.id, userId] });
  else return false;
  return true;
}

// ---------- staff (admin / sub admin) notifications ----------
// The super admin hears about everything. A sub admin only hears about orders that contain THEIR products and reviews of THEIR products.

async function superAdminIds(c: Client): Promise<number[]> {
  return (await c.execute("SELECT id FROM users WHERE role = 'admin' AND status = 'active'")).rows.map((r) => Number(r.id));
}

/** A new order was placed (COD: right away, online: once it is paid). */
export async function notifyStaffNewOrder(c: Client, orderId: number, paidOnline = false): Promise<void> {
  try { await orderEvent(c, orderId, (id, name, amount, mine) => ({ type: "order", title: `New order #${id}`, body: `${name} · ${inr(amount)}${mine ? " for your products" : paidOnline ? " · paid online" : ""}` })); }
  catch (e) { console.error("Staff notification failed:", (e as Error).message); }
}
/** The customer cancelled their own order. */
export async function notifyStaffOrderCancelled(c: Client, orderId: number): Promise<void> {
  try { await orderEvent(c, orderId, (id, name, amount, mine) => ({ type: "order", title: `Order #${id} cancelled by the customer`, body: `${name} · ${inr(amount)}${mine ? " for your products" : ""}` })); }
  catch (e) { console.error("Staff notification failed:", (e as Error).message); }
}
async function orderEvent(c: Client, orderId: number, make: (id: number, name: string, amount: number, mine: boolean) => Omit<NotifyInput, "link">) {
  const o = (await c.execute({ sql: "SELECT customer_name, total FROM orders WHERE id = ?", args: [orderId] })).rows[0];
  if (!o) return;
  const link = `/admin/orders/${orderId}`, name = String(o.customer_name || "A customer");
  const owners = (await c.execute({
    sql: `SELECT p.created_by AS uid, SUM(oi.qty * oi.price) AS share FROM order_items oi JOIN products p ON p.id = oi.product_id
          JOIN users u ON u.id = p.created_by AND u.role = 'subadmin' AND u.status = 'active' WHERE oi.order_id = ? GROUP BY p.created_by`,
    args: [orderId],
  })).rows;
  const supers = await superAdminIds(c);
  for (const id of supers) await notifyUser(c, id, { ...make(orderId, name, Number(o.total), false), link });
  for (const r of owners) await notifyUser(c, Number(r.uid), { ...make(orderId, name, Number(r.share), true), link });
}

/** A customer submitted a review (or edited one, which sends it back for approval). */
export async function notifyStaffReview(c: Client, reviewId: number, kind: "new" | "edited"): Promise<void> {
  try {
    const r = (await c.execute({
      sql: `SELECT r.rating, p.title, p.created_by, ${customerNameSql("u")} AS name FROM reviews r JOIN users u ON u.id = r.user_id LEFT JOIN products p ON p.id = r.product_id WHERE r.id = ?`,
      args: [reviewId],
    })).rows[0];
    if (!r) return;
    const msg: NotifyInput = {
      type: "review", link: "/admin/reviews?f=Pending",
      title: kind === "new" ? "New review to approve" : "Edited review to approve",
      body: `${"★".repeat(Number(r.rating))} for “${r.title ?? "a product"}” by ${String(r.name || "a customer")}`,
    };
    const to = new Set(await superAdminIds(c));
    if (r.created_by) { // the vendor who added the product, if they are an active sub admin
      const v = (await c.execute({ sql: "SELECT id FROM users WHERE id = ? AND role = 'subadmin' AND status = 'active'", args: [Number(r.created_by)] })).rows[0];
      if (v) to.add(Number(v.id));
    }
    for (const id of to) await notifyUser(c, id, msg);
  } catch (e) { console.error("Staff notification failed:", (e as Error).message); }
}
