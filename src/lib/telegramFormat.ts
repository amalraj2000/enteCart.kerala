/**
 * Builds the Telegram "new order" message: bold headings plus aligned columns in monospace (<pre>) blocks, so it reads like a table.
 * Telegram HTML mode only: EVERYTHING that comes from a customer or product is escaped first, so a "<" or "&" in a name can never
 * break the message or inject formatting. Dependency-free on purpose (pure text in, text out).
 */
export type TgOrder = {
  id: number;
  payment: "cod" | "online-paid" | "online-pending";
  name: string; phone: string; house: string; street: string; city: string; state: string; pincode: string;
  items: { title: string; size?: string; qty: number; price: number }[];
  total: number;
  status?: string;
  adminUrl?: string;
};

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rupee = (n: number) => "₹" + Number(n).toLocaleString("en-IN");

/** Word-wraps to `width` columns (long words are cut), at most `maxLines` lines (the last one ends with "…" if text was dropped). */
function wrap(text: string, width: number, maxLines = 99): string[] {
  const words = String(text).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (let w of words) {
    while (w.length > width) { // a single very long word
      if (cur) { lines.push(cur); cur = ""; }
      lines.push(w.slice(0, width)); w = w.slice(width);
    }
    if (!cur) cur = w; else if (cur.length + 1 + w.length <= width) cur += " " + w; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (!lines.length) lines.push("");
  if (lines.length > maxLines) { const k = lines.slice(0, maxLines); k[maxLines - 1] = k[maxLines - 1].slice(0, width - 1).replace(/\s+$/, "") + "…"; return k; }
  return lines;
}

const LABEL = 9, VALUE = 24, ITEM = 17, QTY = 3, AMT = 9; // column widths (≈ 31 characters wide: fits a phone screen without sideways scrolling)
const field = (label: string, value: string | string[]) => {
  const lines = Array.isArray(value) ? value : wrap(value, VALUE);
  return lines.map((l, i) => (i === 0 ? label.padEnd(LABEL) : " ".repeat(LABEL)) + l).join("\n");
};

function itemsTable(o: TgOrder, titleLines: number): string {
  const width = ITEM + 1 + QTY + 1 + AMT;
  const rows = [`${"Item".padEnd(ITEM)} ${"Qty".padStart(QTY)} ${"Amount".padStart(AMT)}`, "─".repeat(width)];
  for (const it of o.items) {
    const t = wrap(`${it.title}${it.size ? ` (${it.size})` : ""}`, ITEM, titleLines);
    t.forEach((line, i) => rows.push(i === 0 ? `${line.padEnd(ITEM)} ${String(it.qty).padStart(QTY)} ${rupee(it.price * it.qty).padStart(AMT)}` : line));
  }
  const total = rupee(o.total);
  rows.push("─".repeat(width), "TOTAL".padEnd(width - total.length) + total);
  return rows.map(esc).join("\n");
}

export function formatTelegramOrder(o: TgOrder): string {
  const pay = o.payment === "cod" ? "💵 <b>Cash on Delivery</b> — collect on delivery" : o.payment === "online-paid" ? "💳 <b>PAID ONLINE</b>" : "💳 <b>Online payment</b> (pending)";
  // Each value sits in its own <code> block: tapping it in Telegram copies just that value.
  const addr = `${o.house}, ${o.street}\n${o.city}, ${o.state} - ${o.pincode}`;
  const customer = [`📛 <b>Name</b>\n<code>${esc(o.name)}</code>`, `📞 <b>Phone</b>\n<code>${esc(o.phone)}</code>`, `📍 <b>Delivery address</b>\n<code>${esc(addr)}</code>`].join("\n\n");
  const build = (titleLines: number) => [
    `🛒 <b>NEW ORDER #${o.id}</b>`,
    pay,
    ...(o.status ? [`📌 Status: <b>${esc(o.status)}</b>`] : []), "",
    "👤 <b>CUSTOMER</b> (tap a value to copy)", customer, "",
    `📦 <b>ITEMS</b> (${o.items.reduce((s, i) => s + i.qty, 0)})`, `<pre>${itemsTable(o, titleLines)}</pre>`,
    ...(o.adminUrl ? ["", `🔗 ${esc(o.adminUrl)}`] : []),
  ].join("\n");
  const full = build(3);
  return full.length <= 3900 ? full : build(1); // Telegram's limit is 4096 characters; a huge order falls back to one line per item
}

const STATUS_BUTTONS: Record<string, [string, string][]> = {
  Placed: [["✅ Confirm order", "Confirmed"], ["❌ Cancel order", "Cancelled"]],
  Confirmed: [["🚚 Mark shipped", "Shipped"], ["❌ Cancel order", "Cancelled"]],
  Shipped: [["📦 Mark delivered", "Delivered"]],
};

/**
 * Buttons under the message. Callback data is "os:<id>:<Status>" (do it), "oc:<id>" (ask "really cancel?") or "ob:<id>" (go back).
 * `actions` = status buttons on (needs the webhook); the copy buttons use the Bot API copy_text (max 256 chars, plain text).
 */
export function telegramKeyboard(o: TgOrder, opts: { actions?: boolean; confirmCancel?: boolean } = {}) {
  const cut = (t: string) => t.slice(0, 256);
  const address = `${o.house}, ${o.street}, ${o.city}, ${o.state} - ${o.pincode}`;
  const copy = (text: string, c: string) => ({ text, copy_text: { text: cut(c) } });
  const rows: object[][] = [];
  if (opts.actions && opts.confirmCancel) {
    rows.push([{ text: `⚠️ Yes, cancel #${o.id}`, callback_data: `os:${o.id}:Cancelled` }, { text: "↩️ No, keep it", callback_data: `ob:${o.id}` }]);
  } else if (opts.actions) {
    for (const [label, st] of STATUS_BUTTONS[o.status || ""] ?? []) rows.push([{ text: label, callback_data: st === "Cancelled" ? `oc:${o.id}` : `os:${o.id}:${st}` }]);
  }
  rows.push(
    [copy("📋 Copy phone", o.phone), copy("📋 Copy name", o.name)],
    [copy("📋 Copy address", address)],
    [copy("📋 Copy name + phone + address", `${o.name}\n${o.phone}\n${address}`)],
  );
  return { inline_keyboard: rows };
}
