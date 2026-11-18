import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { withImages } from "@/lib/orderItems";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import { bad, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { cleanAddress, firstError, validateAddress, validateOrderItems } from "@/lib/validate";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return bad("Login required", 401);
  const c = await db();
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

  const addr = cleanAddress(b);
  const aerr = firstError(validateAddress(addr));
  if (aerr) return bad(aerr);
  const { items: lines, error } = validateOrderItems(b.items);
  if (error) return bad(error);
  if (!(await rateLimit(`order:${user.id}`, 10, 600))) return bad("Too many orders in a short time. Please wait a few minutes.", 429);

  const c = await db();
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
  try {
    const ins = await c.execute({
      sql: `INSERT INTO orders (user_id, customer_name, phone, house_name, street_name, city, state, pincode, items, total)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [user.id, addr.customer_name, addr.phone, addr.house_name, addr.street_name, addr.city, addr.state, addr.pincode, JSON.stringify(items), total],
    });
    return NextResponse.json({ id: Number(ins.lastInsertRowid), total });
  } catch {
    for (const [rid, rq] of reserved) await c.execute({ sql: "UPDATE products SET stock = stock + ? WHERE id = ?", args: [rq, rid] });
    return bad("Could not place the order. Please try again.", 500);
  }
}
