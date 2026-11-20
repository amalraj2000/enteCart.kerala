import type { Client } from "@libsql/client";

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
