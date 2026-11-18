import { inr } from "./types";

/**
 * WhatsApp alert to the shop owner when an order is placed, via CallMeBot's free WhatsApp API
 * (https://www.callmebot.com/blog/free-api-whatsapp-messages/).
 * Needs ADMIN_WHATSAPP (the owner's number) and CALLMEBOT_API_KEY; does nothing if either is missing.
 * Only the order number, total and item count are sent — never the customer's name, phone or address.
 */
export async function notifyNewOrder(o: { id: number; total: number; itemCount: number; adminUrl: string }) {
  const phone = process.env.ADMIN_WHATSAPP, key = process.env.CALLMEBOT_API_KEY;
  if (!phone || !key) return;
  const digits = phone.replace(/\D/g, "");
  const to = digits.length === 10 ? `91${digits}` : digits; // 10-digit Indian numbers get the country code

  const url = new URL(process.env.WHATSAPP_API_URL || "https://api.callmebot.com/whatsapp.php");
  url.searchParams.set("phone", `+${to}`);
  url.searchParams.set("text", `🛒 New order received!\nOrder #${o.id} • ${inr(o.total)} • ${o.itemCount} item${o.itemCount === 1 ? "" : "s"}\n${o.adminUrl}`);
  url.searchParams.set("apikey", key);
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) console.error(`WhatsApp notification failed: HTTP ${r.status}`);
  } catch (e) {
    console.error("WhatsApp notification failed:", (e as Error).message); // never throws: the order is already saved
  }
}
