import { after, NextResponse } from "next/server";
import { notifyNewOrder } from "@/lib/notify";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { withImages } from "@/lib/orderItems";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import { bad, readJson } from "@/lib/http";
import { expireUnpaidOrders } from "@/lib/expireUnpaid";
import { razorpayConfigured } from "@/lib/razorpay";
import { rateLimit } from "@/lib/rateLimit";
import { getSavedAddress, sameAddress, saveAddress } from "@/lib/addresses";
import { cleanAddress, firstError, validateAddress, validateOrderItems } from "@/lib/validate";
export const dynamic = "force-dynamic";

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

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return bad("Please log in to place an order", 401);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");

  const online = b.payment_method === "online";
  if (online && !razorpayConfigured()) return bad("Online payment is not available right now. Please choose Cash on Delivery.", 503);
  const addr = cleanAddress(b);
  const aerr = firstError(validateAddress(addr));
  if (aerr) return bad(aerr);
  const { items: lines, error } = validateOrderItems(b.items);
  if (error) return bad(error);
  if (!(await rateLimit(`order:${user.id}`, 10, 600))) return bad("Too many orders in a short time. Please wait a few minutes.", 429);

  const c = await db();
  await expireUnpaidOrders(c); // give back stock held by abandoned online payments before we check availability
  // Prices, titles, sizes and stock always come from the DB — never from the browser.
  const items: { id: number; title: string; price: number; size: string; qty: number; image_url: string }[] = [];
  const need = new Map<number, number>();
  let total = 0;
  for (const l of lines) {
    const p = (await c.execute({ sql: "SELECT * FROM products WHERE id = ?", args: [l.id] })).rows[0];
    if (!p) return bad("A product in your cart no longer exists");
    const sizes = String(p.sizes).split(",").map((s) => s.trim()).filter(Boolean);
    if (sizes.length ? !sizes.includes(l.size) : l.size !== "") return bad(`Please choose a valid size for "${p.title}"`);
    items.push({ id: l.id, title: String(p.title), price: Number(p.price), size: l.size, qty: l.qty, image_url: String(p.image_url || "") });
    need.set(l.id, (need.get(l.id) || 0) + l.qty);
    total += Number(p.price) * l.qty;
  }

  // Reserve stock atomically (the WHERE stock >= ? guard means two buyers can never oversell); undo on failure.
  const reserved: [number, number][] = [];
  for (const [id, qty] of need) {
    const r = await c.execute({ sql: "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?", args: [qty, id, qty] });
    if (r.rowsAffected !== 1) {
      for (const [rid, rq] of reserved) await c.execute({ sql: "UPDATE products SET stock = stock + ? WHERE id = ?", args: [rq, rid] });
      const t = items.find((i) => i.id === id)?.title;
      return bad(`Sorry, "${t}" doesn't have enough stock left`);
    }
    reserved.push([id, qty]);
  }
  let addressId: number | null = null;
  try {
    // Link the order to the customer's saved address (or save this one if they have none yet).
    // Done BEFORE the transaction opens: the transaction holds the write lock.
    const saved = await getSavedAddress(c, user.id);
    addressId = saved ? (sameAddress(saved, addr) ? saved.id : null) : await saveAddress(c, user.id, addr);
  } catch {
    for (const [rid, rq] of reserved) await c.execute({ sql: "UPDATE products SET stock = stock + ? WHERE id = ?", args: [rq, rid] });
    return bad("Could not place the order. Please try again.", 500);
  }

  const tx = await c.transaction("write");
  try {
    const ins = await tx.execute({
      sql: `INSERT INTO orders (user_id, address_id, customer_name, phone, house_name, street_name, city, state, pincode, total, payment_method, payment_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [user.id, addressId, addr.customer_name, addr.phone, addr.house_name, addr.street_name, addr.city, addr.state, addr.pincode, total, online ? "online" : "cod", online ? "Unpaid" : "Pending"],
    });
    const orderId = Number(ins.lastInsertRowid);
    await tx.batch(
      items.map((i) => ({ sql: "INSERT INTO order_items (order_id, product_id, title, size, qty, price, image_url) VALUES (?,?,?,?,?,?,?)", args: [orderId, i.id, i.title, i.size, i.qty, i.price, i.image_url] })),
    );
    await tx.commit();
    // Runs after the response is sent (Vercel keeps the function alive for it); a failure here never affects the order.
    // Online orders are announced only once the payment succeeds (see markPaid); COD orders right away.
    if (!online) after(() => notifyNewOrder({ id: orderId, total, itemCount: items.reduce((n, i) => n + i.qty, 0), adminUrl: `${new URL(req.url).origin}/admin/orders/${orderId}` }));
    return NextResponse.json({ id: orderId, total });
  } catch {
    await tx.rollback().catch(() => {});
    for (const [rid, rq] of reserved) await c.execute({ sql: "UPDATE products SET stock = stock + ? WHERE id = ?", args: [rq, rid] });
    return bad("Could not place the order. Please try again.", 500);
  } finally {
    tx.close();
  }
}
