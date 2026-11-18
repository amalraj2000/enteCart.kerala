import { inr } from "./types";
import { db } from "./db";

/**
 * WhatsApp alert to the shop owner when an order is placed, via CallMeBot's free WhatsApp API
 * (https://www.callmebot.com/blog/free-api-whatsapp-messages/).
 * Needs ADMIN_WHATSAPP (the owner's number) and CALLMEBOT_API_KEY; does nothing if either is missing.
 * The message goes ONLY to the owner's own number and contains the customer's name, phone, delivery address and the ordered items.
 */
export async function notifyNewOrder(o: { id: number; adminUrl?: string; paidOnline?: boolean }) {
  const phone = process.env.ADMIN_WHATSAPP, key = process.env.CALLMEBOT_API_KEY;
  if (!phone || !key) return;
  try {
    const c = await db();
    const ord = (await c.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [o.id] })).rows[0];
    if (!ord) return;
    const items = (await c.execute({ sql: "SELECT title, size, qty, price FROM order_items WHERE order_id = ? ORDER BY id", args: [o.id] })).rows;
    const online = ord.payment_method === "online";

    const lines = [
      `🛒 NEW ORDER #${o.id}`,
      online ? (o.paidOnline ? "💳 PAID ONLINE" : "💳 Online payment (pending)") : "💵 Cash on Delivery — collect on delivery",
      "",
      "👤 CUSTOMER",
      String(ord.customer_name),
      `📞 ${ord.phone}`,
      `📍 ${ord.house_name}, ${ord.street_name}, ${ord.city}, ${ord.state} - ${ord.pincode}`,
      "",
      "📦 ITEMS",
      ...items.map((i, n) => `${n + 1}. ${i.title}${i.size ? ` (${i.size})` : ""} × ${i.qty} = ${inr(Number(i.price) * Number(i.qty))}`),
      "",
      `💰 TOTAL: ${inr(Number(ord.total))}`,
      ...(o.adminUrl ? ["", o.adminUrl] : []),
    ];
    const text = lines.join("\n").slice(0, 1500); // keep well inside WhatsApp / URL limits

    const digits = phone.replace(/\D/g, "");
    const to = digits.length === 10 ? `91${digits}` : digits; // 10-digit Indian numbers get the country code
    const url = new URL(process.env.WHATSAPP_API_URL || "https://api.callmebot.com/whatsapp.php");
    url.searchParams.set("phone", `+${to}`);
    url.searchParams.set("text", text);
    url.searchParams.set("apikey", key);
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) console.error(`WhatsApp notification failed: HTTP ${r.status}`);
  } catch (e) {
    console.error("WhatsApp notification failed:", (e as Error).message); // never throws: the order is already saved
  }
}
