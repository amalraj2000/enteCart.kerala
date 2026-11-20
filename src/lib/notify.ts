import { inr } from "./types";
import { db } from "./db";

/**
 * Alert to the shop owner when an order is placed, on every channel that is configured:
 *  • WhatsApp via CallMeBot (https://www.callmebot.com/blog/free-api-whatsapp-messages/) — needs ADMIN_WHATSAPP + CALLMEBOT_API_KEY.
 *  • Telegram via your own bot — needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (one id, or several separated by commas, e.g. you + a staff group).
 * A channel that is not configured is simply skipped; if none is configured this does nothing.
 * The message contains the customer's name, phone, delivery address and the ordered items, and goes ONLY to the owner's own chats.
 */
export async function notifyNewOrder(o: { id: number; adminUrl?: string; paidOnline?: boolean }) {
  const waPhone = process.env.ADMIN_WHATSAPP, waKey = process.env.CALLMEBOT_API_KEY;
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChats = (process.env.TELEGRAM_CHAT_ID || "").split(",").map((x) => x.trim()).filter(Boolean);
  const whatsapp = !!(waPhone && waKey), telegram = !!(tgToken && tgChats.length);
  if (!whatsapp && !telegram) return;
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
    const text = lines.join("\n").slice(0, 1500); // keep well inside WhatsApp / URL / Telegram limits

    // Channels are independent: one failing never stops the other, and neither can affect the order (it is already saved).
    await Promise.all([
      whatsapp ? sendWhatsApp(waPhone!, waKey!, text) : null,
      telegram ? sendTelegram(tgToken!, tgChats, text) : null,
    ]);
  } catch (e) {
    console.error("Order notification failed:", (e as Error).message);
  }
}

async function sendWhatsApp(phone: string, key: string, text: string) {
  try {
    const digits = phone.replace(/\D/g, "");
    const to = digits.length === 10 ? `91${digits}` : digits; // 10-digit Indian numbers get the country code
    const url = new URL(process.env.WHATSAPP_API_URL || "https://api.callmebot.com/whatsapp.php");
    url.searchParams.set("phone", `+${to}`);
    url.searchParams.set("text", text);
    url.searchParams.set("apikey", key);
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) console.error(`WhatsApp notification failed: HTTP ${r.status}`);
  } catch (e) { console.error("WhatsApp notification failed:", (e as Error).message); }
}

/** Sends the text to each Telegram chat. Plain text on purpose (no parse_mode), so a customer's name can never break or inject formatting. */
async function sendTelegram(token: string, chats: string[], text: string) {
  const base = process.env.TELEGRAM_API_URL || "https://api.telegram.org";
  await Promise.all(chats.map(async (chat) => {
    try {
      const r = await fetch(`${base}/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) console.error(`Telegram notification to ${chat} failed: HTTP ${r.status} ${(await r.text().catch(() => "")).slice(0, 150)}`); // never log the URL: it contains the bot token
    } catch (e) { console.error(`Telegram notification to ${chat} failed:`, (e as Error).name); } // error text can echo the URL, so only the type is logged
  }));
}
