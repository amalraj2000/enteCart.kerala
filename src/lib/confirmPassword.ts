import bcrypt from "bcryptjs";
import type { Client } from "@libsql/client";

/**
 * Handing out (or taking away) super admin power is the most sensitive thing in the shop, so it asks the person doing it to re-enter
 * THEIR OWN password. A stolen browser session alone is then not enough to create a new super admin.
 */
export async function confirmOwnPassword(c: Client, userId: number, password: unknown): Promise<boolean> {
  if (typeof password !== "string" || !password || password.length > 72) return false;
  const row = (await c.execute({ sql: "SELECT password FROM users WHERE id = ?", args: [userId] })).rows[0];
  return !!row && (await bcrypt.compare(password, String(row.password)));
}
