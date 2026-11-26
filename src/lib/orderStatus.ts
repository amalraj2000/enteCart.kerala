import type { Client } from "@libsql/client";
import { revalidateCatalog } from "./catalog";
import { editableOrderIds } from "./permissions";
import { reserveOrder, restockOrder } from "./orderStock";
import { notifyUser, orderStatusNotice } from "./notifications";
import type { StaffRole } from "./session";

/** Allowed moves. Orders only go forward; cancelling is possible until it ships; a cancelled order can be re-opened (stock permitting). */
export const NEXT: Record<string, string[]> = {
  Placed: ["Confirmed", "Cancelled"],
  Confirmed: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: [],
  Cancelled: ["Placed"],
};

export type StatusResult = { ok: true; unchanged?: boolean } | { ok: false; error: string; status: number };

/**
 * The ONE place an order's status is changed (admin panel and the Telegram buttons both use it): forward-only moves, stock
 * restore/reserve, refund/unpaid rules, race-safe UPDATE, and the customer's notification.
 * `actor` = the staff member (a sub admin may only change orders with their products); `null` = the shop owner acting through
 * their own private Telegram chat, which is already restricted to the owner's chat ids.
 */
export async function changeOrderStatus(c: Client, id: number, next: string, actor: { id: number; role: StaffRole } | null): Promise<StatusResult> {
  const cur = (await c.execute({ sql: "SELECT status, payment_status, payment_method, user_id, public_id, order_no FROM orders WHERE id = ?", args: [id] })).rows[0];
  if (!cur) return { ok: false, error: "Order not found", status: 404 };
  if (actor && !(await editableOrderIds(c, actor, [id])).has(id)) return { ok: false, error: "You can only update orders that include products you added", status: 403 };
  const prev = String(cur.status);
  if (prev === next) return { ok: true, unchanged: true };
  if (!(NEXT[prev] ?? []).includes(next)) return { ok: false, error: `A ${prev.toLowerCase()} order can't be moved to “${next}”.`, status: 409 };

  if (cur.payment_status === "Refunded" && next !== "Cancelled") return { ok: false, error: "This order was refunded, so it can't be re-opened.", status: 409 };
  if (cur.payment_method === "online" && cur.payment_status === "Unpaid" && next !== "Placed" && next !== "Cancelled") return { ok: false, error: "This online order hasn't been paid yet, so it can't be confirmed or shipped.", status: 409 };
  // Re-opening a cancelled order takes its items out of stock again — refuse if there isn't enough.
  if (prev === "Cancelled" && !(await reserveOrder(c, id))) return { ok: false, error: "Not enough stock to re-open this cancelled order.", status: 409 };

  // Guarded on the status we just read, so a customer cancelling at the same moment can't be overwritten silently.
  const r = await c.execute({ sql: "UPDATE orders SET status = ? WHERE id = ? AND status = ?", args: [next, id, prev] });
  if (r.rowsAffected !== 1) {
    if (prev === "Cancelled") await restockOrder(c, id); // undo the reservation
    return { ok: false, error: "This order was just changed by someone else — please reload.", status: 409 };
  }
  if (next === "Cancelled") await restockOrder(c, id);
  const notice = orderStatusNotice(cur.order_no ? String(cur.order_no) : id, next); // tell the customer (bell in their header)
  if (notice && cur.user_id) await notifyUser(c, Number(cur.user_id), { type: "order", ...notice, link: `/orders/${cur.public_id || id}` });
  revalidateCatalog();
  return { ok: true };
}
