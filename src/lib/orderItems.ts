import { db } from "./db";
import { addedBySql, vendorSql } from "./staffLabel";

export type OrderItem = { id: number | null; title: string; price: number; size?: string; qty: number; image_url: string; added_by?: string | null; vendor?: string | null };
export type FullOrder = Record<string, any> & { items: OrderItem[] };

/** Attaches each order's line items (from the order_items table) and falls back to the product's photo if none was stored. */
/** `admins: true` (staff screens ONLY — never the customer API) also tells which admin added each product. */
export async function withImages(rows: any[], opts: { admins?: boolean } = {}): Promise<FullOrder[]> {
  const orders = rows.map((r) => JSON.parse(JSON.stringify(r)));
  if (!orders.length) return [];
  const c = await db();
  const ids = orders.map((o) => Number(o.id));
  const items = (await c.execute({
    sql: `SELECT oi.order_id, oi.product_id, oi.title, oi.size, oi.qty, oi.price, oi.image_url, p.image_url AS product_image,
                 ${vendorSql("p.created_by", "cu")} AS vendor
                 ${opts.admins ? `, ${addedBySql("p.created_by", "cu")} AS added_by` : ""}
          FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
          LEFT JOIN users cu ON cu.id = p.created_by
          WHERE oi.order_id IN (${ids.map(() => "?").join(",")}) ORDER BY oi.id`,
    args: ids,
  })).rows;
  const by = new Map<number, OrderItem[]>();
  for (const i of items) {
    const list = by.get(Number(i.order_id)) ?? [];
    list.push({ id: i.product_id === null ? null : Number(i.product_id), title: String(i.title), price: Number(i.price), size: String(i.size || ""), qty: Number(i.qty), image_url: String(i.image_url || i.product_image || ""), vendor: i.vendor ? String(i.vendor) : null, ...(opts.admins ? { added_by: i.added_by ? String(i.added_by) : null } : {}) });
    by.set(Number(i.order_id), list);
  }
  return orders.map((o) => ({ ...o, items: by.get(Number(o.id)) ?? [] }));
}
