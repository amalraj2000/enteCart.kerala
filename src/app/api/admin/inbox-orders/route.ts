import { NextResponse } from "next/server";
import { bad, readJson } from "@/lib/http";
import { cleanInbox, nextOrderNo, resolveItems, totals, validateInbox } from "@/lib/inbox";
import { firstError } from "@/lib/validate";
import { inboxGuard } from "./guard";

export const dynamic = "force-dynamic";

/** Create an inbox order — like a normal checkout: ONE order with one or more products. Order id, items and first history row are written in ONE transaction. */
export async function POST(req: Request) {
  const g = await inboxGuard(); if ("error" in g) return g.error;
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const v = cleanInbox(b);
  const res = await resolveItems(g.c, v.items, null); // name / price / image come from the store's product, not the browser
  if (res.error) return NextResponse.json({ error: res.error, errors: { items: res.error } }, { status: 400 });
  v.items = res.items;
  const errors = validateInbox(v, b);
  if (firstError(errors)) return NextResponse.json({ error: firstError(errors), errors }, { status: 400 });
  const { subtotal, total } = totals(v);
  const actor = g.me.name || g.me.identifier;
  const tx = await g.c.transaction("write");
  try {
    const orderNo = await nextOrderNo(tx);
    const r = await tx.execute({
      sql: `INSERT INTO inbox_orders (order_no, customer_name, phone, house_name, street_name, city, state, pincode, instructions, source, order_date, payment_method, payment_status, status, tracking_number, notes, subtotal, delivery_charge, discount, total, created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [orderNo, v.customer_name, v.phone, v.house_name, v.street_name, v.city, v.state, v.pincode, v.instructions, v.source, v.order_date, v.payment_method, v.payment_status, v.status, v.tracking_number, v.notes, subtotal, v.delivery_charge, v.discount, total, g.me.id],
    });
    const id = Number(r.lastInsertRowid);
    for (const it of v.items) {
      let pid = it.product_id;
      if (pid) pid = (await tx.execute({ sql: "SELECT id FROM products WHERE id = ?", args: [pid] })).rows[0] ? pid : null;
      await tx.execute({ sql: "INSERT INTO inbox_order_items (order_id, product_id, title, qty, price, image_url) VALUES (?,?,?,?,?,?)", args: [id, pid, it.title, it.qty, it.price, it.image_url] });
    }
    await tx.execute({ sql: "INSERT INTO inbox_order_history (order_id, event, actor) VALUES (?,?,?)", args: [id, `Order created via ${v.source} — status ${v.status}`, actor] });
    await tx.commit();
    return NextResponse.json({ ok: true, id, order_no: orderNo });
  } catch (e) {
    await tx.rollback().catch(() => {});
    console.error("inbox create failed", e);
    return bad("Could not save the order. Please try again.", 500);
  } finally { tx.close(); }
}
