import type { Client } from "@libsql/client";
/** "New user voucher": ₹ off the customer's very first order. */
export const WELCOME_OFF = 10;
/** Eligible = this customer has never placed any order (a cancelled one still counts, so cancelling and re-ordering can't reuse it). */
export async function welcomeEligible(c: Client, userId: number): Promise<boolean> {
  const off = (await c.execute("SELECT value FROM settings WHERE key = 'welcome_voucher'")).rows[0]?.value === "0"; // owner's switch (Admin → Settings); missing = ON
  if (off) return false;
  const r = await c.execute({ sql: "SELECT COUNT(*) AS n FROM orders WHERE user_id = ?", args: [userId] });
  return Number(r.rows[0].n) === 0;
}
/** The discount for an order of this subtotal (never makes the order free: at least ₹1 stays payable). */
export const welcomeDiscount = (subtotal: number) => Math.max(0, Math.min(WELCOME_OFF, subtotal - 1));
