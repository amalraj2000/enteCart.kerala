import type { Client } from "@libsql/client";
import type { StaffRole } from "./session";

type Me = { id: number; role: StaffRole };

/** The super admin may edit anything; a sub admin may edit only rows they created themselves. */
export const canEditRow = (me: Me, createdBy: unknown) => me.role === "admin" || (createdBy !== null && createdBy !== undefined && Number(createdBy) === me.id);

/**
 * Everyone on staff can VIEW every order. Only the super admin — or a sub admin whose own product is in the order —
 * can CHANGE it. Returns which of `ids` the person may update.
 */
export async function editableOrderIds(c: Client, me: Me, ids: number[]): Promise<Set<number>> {
  if (me.role === "admin") return new Set(ids);
  if (!ids.length) return new Set();
  const r = await c.execute({
    sql: `SELECT DISTINCT oi.order_id AS id FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE p.created_by = ? AND oi.order_id IN (${ids.map(() => "?").join(",")})`,
    args: [me.id, ...ids],
  });
  return new Set(r.rows.map((x) => Number(x.id)));
}

