import { after, NextResponse } from "next/server";
import { notifyNewOrder } from "@/lib/notify";
import { revalidateCatalogSoon } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { withImages } from "@/lib/orderItems";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import { bad, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { newPublicId } from "@/lib/publicId";
import { expireUnpaidOrders } from "@/lib/expireUnpaid";
import { razorpayConfigured } from "@/lib/razorpay";
import { onlinePaymentsEnabled } from "@/lib/settings";
import { CATEGORY_JOIN, VISIBLE } from "@/lib/visibility";
import { getSavedAddress, sameAddress } from "@/lib/addresses";
import { cleanAddress, firstError, validateAddress, validateOrderItems } from "@/lib/validate";
export const dynamic = "force-dynamic";
const MAX_OPEN_COD = 3;

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return bad("Login required", 401);
  const c = await db();
  await expireUnpaidOrders(c);
  const total = Number((await c.execute({ sql: "SELECT COUNT(*) AS n FROM orders WHERE user_id = ?", args: [user.id] })).rows[0].n);
  const pi = pageInfo(total, parsePage(new URL(req.url).searchParams.get("page")));
  const r = await c.execute({ sql: `SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT ${PAGE_SIZE} OFFSET ?`, args: [user.id, pi.offset] });
  return NextResponse.json({ orders: await withImages(r.rows), page: pi.page, totalPages: pi.totalPages, total });
}

/** Links the order to the customer's saved address (or saves this one if they have none yet), with as few writes as possible. Never throws. */
async function linkAddress(c: Awaited<ReturnType<typeof db>>, userId: number, orderId: number, addr: ReturnType<typeof cleanAddress>) {
  try {
    const saved = await getSavedAddress(c, userId);
    if (saved) {
      if (sameAddress(saved, addr)) await c.execute({ sql: "UPDATE orders SET address_id = ? WHERE id = ?", args: [saved.id, orderId] });
      return; // a different address than the saved one: the order keeps its own address snapshot, the saved address is left alone
    }
    // First order: save the address, point the user and this order at it — all three in ONE write.
    const mine = "(SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1)";
    await c.batch([
      { sql: "INSERT INTO addresses (user_id, full_name, phone, house_name, street_name, city, state, pincode) VALUES (?,?,?,?,?,?,?,?)", args: [userId, addr.customer_name, addr.phone, addr.house_name, addr.street_name, addr.city, addr.state, addr.pincode] },
      { sql: `UPDATE users SET address_id = ${mine}, name = ? WHERE id = ?`, args: [userId, addr.customer_name, userId] },
      { sql: `UPDATE orders SET address_id = ${mine} WHERE id = ?`, args: [userId, orderId] },
    ], "write");
  } catch (e) { console.error("Linking saved address failed:", (e as Error).message); }
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return bad("Please log in to place an order", 401);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");

  const online = b.payment_method === "online";
  if (online && !razorpayConfigured()) return bad("Online payment is not available right now. Please choose Cash on Delivery.", 503);
  if (online && !(await onlinePaymentsEnabled())) return bad("Online payment is not available right now. Please choose Cash on Delivery.", 503); // switched off by the owner
  const addr = cleanAddress(b);
  const aerr = firstError(validateAddress(addr));
  if (aerr) return bad(aerr);
  const { items: lines, error } = validateOrderItems(b.items);
  if (error) return bad(error);
  const c = await db();
  // Anti-spam: at most 10 orders per 10 minutes per customer. Counted from the orders table itself — a plain read, no extra write
  // on every checkout, and exact across all servers. (Attempts that fail, e.g. sold out, don't count.)
  const recent = Number((await c.execute({ sql: "SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND created_at > datetime('now', '-10 minutes')", args: [user.id] })).rows[0].n);
  if (recent >= 10 || !(await rateLimit(`order:${user.id}`, 10, 600))) return bad("Too many orders in a short time. Please wait a few minutes.", 429); // the 2nd check is an atomic counter, so parallel requests can't slip past
  // Cash-on-delivery orders hold stock until the shop acts on them, so a customer can only have a few waiting at once.
  if (!online) {
    const open = Number((await c.execute({ sql: "SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND payment_method = 'cod' AND status = 'Placed'", args: [user.id] })).rows[0].n);
    if (open >= MAX_OPEN_COD) return bad(`You already have ${MAX_OPEN_COD} Cash on Delivery orders waiting for confirmation. Please wait for them to be confirmed, or pay online.`, 429);
  }
  // Same idea for online orders: stock is held for 30 min while unpaid, so one account can't tie up inventory with abandoned payments.
  if (online) {
    const unpaid = Number((await c.execute({ sql: "SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND payment_method = 'online' AND payment_status = 'Unpaid' AND status = 'Placed'", args: [user.id] })).rows[0].n);
    if (unpaid >= MAX_OPEN_COD) return bad(`You have ${MAX_OPEN_COD} online orders waiting for payment. Please pay or cancel them first.`, 429);
  }
  await expireUnpaidOrders(c); // give back stock held by abandoned online payments (at most once a minute per server)

  // 1) Prices, titles, sizes and stock always come from the DB — never from the browser. ONE query for all cart lines.
  const ids = [...new Set(lines.map((l) => l.id))];
  const prows = (await c.execute({ sql: `SELECT p.* FROM products p ${CATEGORY_JOIN} WHERE p.id IN (${ids.map(() => "?").join(",")}) AND ${VISIBLE}`, args: ids })).rows;
  const byId = new Map(prows.map((p) => [Number(p.id), p]));
  const items: { id: number; title: string; price: number; size: string; qty: number; image_url: string }[] = [];
  const need = new Map<number, number>();
  let total = 0;
  for (const l of lines) {
    const p = byId.get(l.id);
    if (!p) {
      const t = (await c.execute({ sql: "SELECT title FROM products WHERE id = ?", args: [l.id] })).rows[0];
      return bad(t ? `“${t.title}” is no longer available. Please remove it from your cart.` : "A product in your cart was removed from the shop. Please remove it from your cart.", 409);
    }
    const sizes = String(p.sizes).split(",").map((s) => s.trim()).filter(Boolean);
    if (sizes.length ? !sizes.includes(l.size) : l.size !== "") return bad(`Please choose a valid size for "${p.title}"`);
    items.push({ id: l.id, title: String(p.title), price: Number(p.price), size: l.size, qty: l.qty, image_url: String(p.image_url || "") });
    need.set(l.id, (need.get(l.id) || 0) + l.qty);
    total += Number(p.price) * l.qty;
  }

  // Fail fast when stock is already short (the common case in a rush on a popular item): costs one read, zero writes.
  for (const [id, qty] of need) {
    const p = byId.get(id)!;
    if (Number(p.stock) < qty) return bad(`Sorry, "${p.title}" doesn't have enough stock left`);
  }

  // 3) Reserve stock + create the order + its items in ONE atomic batch = one database round trip and one short write lock.
  //    (The old way — a reservation per product, then an open transaction with its own round trips — held the single SQLite
  //    write lock for far longer, which is what makes a rush of simultaneous orders queue up.)
  //    Overselling is impossible: each UPDATE only succeeds while stock >= qty, and the check right after it raises an error
  //    when it didn't, which rolls back the WHOLE batch — nothing is reserved, nothing needs "undoing".
  //    json('!') is just a deliberate error: invalid JSON → "malformed JSON".
  const publicId = newPublicId();
  const stmts: { sql: string; args: (string | number | null)[] }[] = [];
  for (const [id, qty] of need) {
    stmts.push({ sql: "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?", args: [qty, id, qty] });
    stmts.push({ sql: "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('!') END", args: [] });
  }
  stmts.push({
    sql: `INSERT INTO orders (user_id, address_id, customer_name, phone, house_name, street_name, city, state, pincode, total, payment_method, payment_status, public_id)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [user.id, null, addr.customer_name, addr.phone, addr.house_name, addr.street_name, addr.city, addr.state, addr.pincode, total, online ? "online" : "cod", online ? "Unpaid" : "Pending", publicId],
  });
  // Writers are serialised by SQLite, so inside this one transaction this user's newest order IS the one just inserted.
  const newest = "(SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1)";
  for (const i of items)
    stmts.push({ sql: `INSERT INTO order_items (order_id, product_id, title, size, qty, price, image_url) VALUES (${newest},?,?,?,?,?,?)`, args: [user.id, i.id, i.title, i.size, i.qty, i.price, i.image_url] });
  stmts.push({ sql: `SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1`, args: [user.id] });

  try {
    const res = await c.batch(stmts, "write");
    const orderId = Number(res[res.length - 1].rows[0].id);
    // Runs after the response is sent (Vercel keeps the function alive for it); a failure here never affects the order.
    // Online orders are announced only once the payment succeeds (see markPaid); COD orders right away.
    // Linking the order to the customer's saved address is bookkeeping, not part of "the order exists": done after the response.
    after(() => linkAddress(c, user.id, orderId, addr));
    if (!online) after(() => notifyNewOrder({ id: orderId, adminUrl: `${new URL(req.url).origin}/admin/orders/${orderId}` }));
    revalidateCatalogSoon();
    return NextResponse.json({ id: orderId, pid: publicId, total });
  } catch {
    // The batch rolled back as a whole. Most likely somebody else took the last items a moment ago — say which one.
    const now = (await c.execute({ sql: `SELECT id, title, stock FROM products WHERE id IN (${ids.map(() => "?").join(",")})`, args: ids }).catch(() => null))?.rows ?? [];
    const short = now.find((p) => Number(p.stock) < (need.get(Number(p.id)) || 0));
    if (short) return bad(`Sorry, "${short.title}" doesn't have enough stock left`);
    return bad("Could not place the order. Please try again.", 500);
  }
}
