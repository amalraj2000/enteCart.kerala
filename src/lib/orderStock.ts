import type { Client } from "@libsql/client";

/** Puts an order's items back into stock (used when an order is cancelled). */
export async function restockOrder(c: Client, orderId: number) {
  await c.execute({
    sql: `UPDATE products SET stock = stock + (SELECT COALESCE(SUM(qty), 0) FROM order_items WHERE order_id = ? AND product_id = products.id)
          WHERE id IN (SELECT product_id FROM order_items WHERE order_id = ? AND product_id IS NOT NULL)`,
    args: [orderId, orderId],
  });
}

/** Takes an order's items out of stock again (admin re-opens a cancelled order). Returns false, changing nothing, if stock is short. */
export async function reserveOrder(c: Client, orderId: number): Promise<boolean> {
  const lines = (await c.execute({ sql: "SELECT product_id, SUM(qty) AS qty FROM order_items WHERE order_id = ? AND product_id IS NOT NULL GROUP BY product_id", args: [orderId] })).rows;
  const done: [number, number][] = [];
  for (const l of lines) {
    const r = await c.execute({ sql: "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?", args: [Number(l.qty), Number(l.product_id), Number(l.qty)] });
    if (r.rowsAffected !== 1) {
      for (const [id, q] of done) await c.execute({ sql: "UPDATE products SET stock = stock + ? WHERE id = ?", args: [q, id] });
      return false;
    }
    done.push([Number(l.product_id), Number(l.qty)]);
  }
  return true;
}
