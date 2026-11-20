import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { changeOrderStatus } from "@/lib/orderStatus";
import { loadTgOrder, statusButtonsOn } from "@/lib/notify";
import { formatTelegramOrder, telegramKeyboard } from "@/lib/telegramFormat";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const sha = (s: string) => createHash("sha256").update(s).digest();
const base = () => process.env.TELEGRAM_API_URL || "https://api.telegram.org";
async function tg(method: string, body: object) {
  try {
    const r = await fetch(`${base()}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch { return false; } // never log: the error text can contain the bot token URL
}

/**
 * Telegram calls this when the shop owner taps a button under an order message (setWebhook with TELEGRAM_WEBHOOK_SECRET).
 * Three checks before anything happens: the secret header Telegram echoes back, the chat must be one of TELEGRAM_CHAT_ID, and the
 * button data must match a strict pattern. The status change then goes through the same rules as the admin panel (lib/orderStatus.ts).
 */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!statusButtonsOn() || !secret) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  const got = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!timingSafeEqual(sha(got), sha(secret))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const u = await readJson(req);
  const cq = u && typeof u === "object" ? (u as any).callback_query : null;
  if (!cq || typeof cq.id !== "string") return NextResponse.json({ ok: true }); // some other update type: nothing to do
  const answer = (text: string) => tg("answerCallbackQuery", { callback_query_id: cq.id, text: text.slice(0, 190), show_alert: false });

  const chats = (process.env.TELEGRAM_CHAT_ID || "").split(",").map((x) => x.trim()).filter(Boolean);
  const chatId = String(cq.message?.chat?.id ?? "");
  const messageId = Number(cq.message?.message_id);
  if (!chats.includes(chatId) || !Number.isInteger(messageId)) { await answer("Not allowed"); return NextResponse.json({ ok: true }); }

  const m = /^(os|oc|ob):(\d{1,9})(?::(Confirmed|Shipped|Delivered|Cancelled))?$/.exec(String(cq.data ?? ""));
  if (!m || (m[1] === "os") !== !!m[3]) { await answer("Unknown button"); return NextResponse.json({ ok: true }); }
  const [, kind, idStr, status] = m, id = Number(idStr);
  const c = await db();
  const adminUrl = `${siteUrl()}/admin/orders/${id}`;

  let note = "";
  if (kind === "os") {
    const r = await changeOrderStatus(c, id, status, null);
    note = r.ok ? `Order #${id} → ${status}` : r.error;
  }
  const o = await loadTgOrder(c, id, { adminUrl });
  if (!o) { await answer("Order not found"); return NextResponse.json({ ok: true }); }
  await answer(note || (kind === "oc" ? "Tap “Yes” to cancel" : "OK"));
  // Re-draw the same message with the new status and the buttons that now make sense.
  await tg("editMessageText", {
    chat_id: chatId, message_id: messageId, text: formatTelegramOrder(o), parse_mode: "HTML", disable_web_page_preview: true,
    reply_markup: telegramKeyboard(o, { actions: true, confirmCancel: kind === "oc" }),
  });
  return NextResponse.json({ ok: true });
}
