import { db } from "./db";

export const SETTING_KEYS = ["shop_phone", "shop_whatsapp", "shop_email", "shop_address", "shop_hours", "shop_about", "social_instagram", "social_facebook", "social_youtube", "show_new_arrivals", "show_best_sellers"] as const;
/** On/off switches stored as "1" / "0". A missing value means ON, so the sections stay visible until the owner turns them off. */
export const TOGGLE_KEYS = ["show_new_arrivals", "show_best_sellers"] as const;
export type Settings = Record<(typeof SETTING_KEYS)[number], string>;

/** Public shop details shown in the footer and on the contact page (edited in admin → Settings). */
export async function getSettings(): Promise<Settings> {
  const c = await db();
  const rows = (await c.execute("SELECT key, value FROM settings")).rows;
  const m = new Map(rows.map((r) => [String(r.key), String(r.value)]));
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, m.get(k) ?? ((TOGGLE_KEYS as readonly string[]).includes(k) ? "1" : "")])) as Settings;
}

/**
 * Owner's switch for ONLINE payment at checkout (Admin → Payments). Stored in `settings` as "1"/"0"; missing = ON.
 * Deliberately not part of SETTING_KEYS, so saving the shop-details form can never flip it.
 * It only affects NEW orders — customers with an existing unpaid online order can still pay it.
 */
export const ONLINE_PAYMENTS_KEY = "online_payments";
export async function onlinePaymentsEnabled(): Promise<boolean> {
  const c = await db();
  const r = (await c.execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [ONLINE_PAYMENTS_KEY] })).rows[0];
  return String(r?.value ?? "1") !== "0";
}
