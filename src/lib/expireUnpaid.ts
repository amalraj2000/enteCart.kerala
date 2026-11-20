import type { Client } from "@libsql/client";
import { reconcilePayment } from "@/lib/reconcilePayment";
import { revalidateCatalogSoon } from "@/lib/catalog";
import { restockOrder } from "@/lib/orderStock";
import { notifyUser } from "@/lib/notifications";

export const UNPAID_MINUTES = 30;

/**
 * Online orders reserve stock the moment they are created. If the customer never pays, give that stock back after
 * UNPAID_MINUTES — otherwise anyone could lock up inventory by abandoning payments. Before cancelling, ask Razorpay once more
 * (the customer may have paid without our browser hearing about it); only still-unpaid orders are cancelled.
 */
let lastRun = 0;
export async function expireUnpaidOrders(c: Client) {
  // Housekeeping, not per-order work: at most once a minute per server instance, so a rush of orders doesn't each pay for it.
  if (Date.now() - lastRun < 60_000) return;
  lastRun = Date.now();
  try {
    const rows = (await c.execute({
      sql: `SELECT id FROM orders WHERE payment_method = 'online' AND payment_status = 'Unpaid' AND status = 'Placed'
            AND created_at < datetime('now', '-${UNPAID_MINUTES} minutes') LIMIT 20`, args: [],
    })).rows;
    for (const r of rows) {
      const id = Number(r.id);
      if ((await reconcilePayment(c, id)) !== "Unpaid") continue; // it was paid after all
      const u = await c.execute({ sql: "UPDATE orders SET status = 'Cancelled' WHERE id = ? AND payment_status = 'Unpaid' AND status = 'Placed'", args: [id] });
      if (u.rowsAffected === 1) {
        await restockOrder(c, id); revalidateCatalogSoon();
        const o = (await c.execute({ sql: "SELECT user_id, public_id FROM orders WHERE id = ?", args: [id] })).rows[0];
        if (o?.user_id) await notifyUser(c, Number(o.user_id), { type: "order", title: `Order #${id} cancelled`, body: "Your online payment was not completed in time, so the order was cancelled. You can place it again anytime.", link: `/orders/${o.public_id || id}` });
      }
    }
  } catch { /* housekeeping must never break the request that triggered it */ }
}
