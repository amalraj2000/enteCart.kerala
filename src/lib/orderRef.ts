import type { Client } from "@libsql/client";
import { isPublicId } from "./publicId";

/**
 * Customer-facing order links use the order's opaque public id (/orders/k7m2x9qa4t), never the running number.
 * Resolves what is in the URL to the real order id — ONLY for the logged-in owner (user_id is part of the query).
 * Old numeric links still resolve for the owner, so bookmarks keep working (the pages then move to the opaque address).
 */
export async function resolveOwnOrder(c: Client, userId: number, ref: string): Promise<{ id: number; publicId: string } | null> {
  let r;
  if (isPublicId(ref)) r = await c.execute({ sql: "SELECT id, public_id FROM orders WHERE public_id = ? AND user_id = ?", args: [ref, userId] });
  else if (/^\d{1,12}$/.test(ref)) r = await c.execute({ sql: "SELECT id, public_id FROM orders WHERE id = ? AND user_id = ?", args: [Number(ref), userId] });
  else return null;
  const row = r.rows[0];
  return row ? { id: Number(row.id), publicId: String(row.public_id || "") } : null;
}
