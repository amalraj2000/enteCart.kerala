import { db } from "./db";

export const SETTING_KEYS = ["shop_phone", "shop_whatsapp", "shop_email", "shop_address", "shop_hours", "shop_about", "social_instagram", "social_facebook", "social_youtube"] as const;
export type Settings = Record<(typeof SETTING_KEYS)[number], string>;

/** Public shop details shown in the footer and on the contact page (edited in admin → Settings). */
export async function getSettings(): Promise<Settings> {
  const c = await db();
  const rows = (await c.execute("SELECT key, value FROM settings")).rows;
  const m = new Map(rows.map((r) => [String(r.key), String(r.value)]));
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, m.get(k) ?? ""])) as Settings;
}
