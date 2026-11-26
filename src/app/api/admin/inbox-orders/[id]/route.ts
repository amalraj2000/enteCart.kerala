import { NextResponse } from "next/server";
import { bad, readJson } from "@/lib/http";
import { PAY_STATUSES, STATUSES, cleanInbox, totals, validateInbox, type InboxInput } from "@/lib/inbox";
import { firstError, parseId } from "@/lib/validate";
import { inboxGuard } from "../guard";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Edit everything about an order (customer, address, products, payment, status, tracking, notes). Changes are written to the history. */
export async function PUT(req: Request, { params }: Ctx) {
  const g = await inboxGuard(); if ("error" in g) return g.error;
  const id = parseId((await params).id); if (!id) return bad("Order not found", 404);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const v = cleanInbox(b);
  const errors = validateInbox(v, b);
  if (firstError(errors)) return NextResponse.json({ error: firstError(errors), errors }, { status: 400 });
  const { subtotal, total } = totals(v);
  const actor = g.me.name || g.me.identifier;
  const tx = await g.c.transaction("write");
  try {
    const old = (await tx.execute({ sql: "SELECT status, payment_status, tracking_number FROM inbox_orders WHERE id = ?", args: [id] })).rows[0];
    if (!old) { await tx.rollback(); return bad("Order not found", 404); }
    await tx.execute({
      sql: `UPDATE inbox_orders SET customer_name=?, phone=?, house_name=?, street_name=?, city=?, state=?, pincode=?, instructions=?, source=?, order_date=?, payment_method=?, payment_status=?, status=?, tracking_number=?, notes=?, subtotal=?, delivery_charge=?, discount=?, total=?, updated_at=datetime('now') WHERE id=?`,
      args: [v.customer_name, v.phone, v.house_name, v.street_name, v.city, v.state, v.pincode, v.instructions, v.source, v.order_date, v.payment_method, v.payment_status, v.status, v.tracking_number, v.notes, subtotal, v.delivery_charge, v.discount, total, id],
    });
    await tx.execute({ sql: "DELETE FROM inbox_order_items WHERE order_id = ?", args: [id] });
    for (const it of v.items) {
      let pid = it.product_id;
      if (pid) pid = (await tx.execute({ sql: "SELECT id FROM products WHERE id = ?", args: [pid] })).rows[0] ? pid : null;
      await tx.execute({ sql: "INSERT INTO inbox_order_items (order_id, product_id, title, qty, price, image_url) VALUES (?,?,?,?,?,?)", args: [id, pid, it.title, it.qty, it.price, it.image_url] });
    }
    await history(tx, id, actor, old, v, "Order details edited");
    await tx.commit();
    return NextResponse.json({ ok: true });
  } catch (e) {
    await tx.rollback().catch(() => {});
    console.error("inbox update failed", e);
    return bad("Could not save the changes. Please try again.", 500);
  } finally { tx.close(); }
}

/** Quick update from the list/detail: status, payment status, tracking number and/or notes. */
export async function PATCH(req: Request, { params }: Ctx) {
  const g = await inboxGuard(); if ("error" in g) return g.error;
  const id = parseId((await params).id); if (!id) return bad("Order not found", 404);
  const b = await readJson(req, 20_000);
  if (!b) return bad("Invalid request");
  const sets: string[] = [], args: (string | number)[] = [];
  const next: Partial<InboxInput> = {};
  if (b.status !== undefined) { if (!(STATUSES as readonly string[]).includes(String(b.status))) return bad("Invalid status"); sets.push("status = ?"); args.push(String(b.status)); next.status = String(b.status); }
  if (b.payment_status !== undefined) { if (!(PAY_STATUSES as readonly string[]).includes(String(b.payment_status))) return bad("Invalid payment status"); sets.push("payment_status = ?"); args.push(String(b.payment_status)); next.payment_status = String(b.payment_status); }
  if (b.tracking_number !== undefined) { const t = typeof b.tracking_number === "string" ? b.tracking_number.trim().replace(/\s+/g, " ") : ""; if (t.length > 60) return bad("Tracking number is too long"); sets.push("tracking_number = ?"); args.push(t); next.tracking_number = t; }
  if (b.notes !== undefined) { const n = typeof b.notes === "string" ? b.notes.trim() : ""; if (n.length > 1000) return bad("Notes are too long (max 1000)"); sets.push("notes = ?"); args.push(n); }
  if (!sets.length) return bad("Nothing to update");
  const tx = await g.c.transaction("write");
  try {
    const old = (await tx.execute({ sql: "SELECT status, payment_status, tracking_number FROM inbox_orders WHERE id = ?", args: [id] })).rows[0];
    if (!old) { await tx.rollback(); return bad("Order not found", 404); }
    await tx.execute({ sql: `UPDATE inbox_orders SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`, args: [...args, id] });
    await history(tx, id, g.me.name || g.me.identifier, old, next, b.notes !== undefined ? "Notes updated" : "");
    await tx.commit();
    return NextResponse.json({ ok: true });
  } catch (e) {
    await tx.rollback().catch(() => {});
    console.error("inbox patch failed", e);
    return bad("Could not update the order", 500);
  } finally { tx.close(); }
}

/** Delete an order for good (its items and history go with it). The UI asks for confirmation first. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await inboxGuard(); if ("error" in g) return g.error;
  const id = parseId((await params).id); if (!id) return bad("Order not found", 404);
  const tx = await g.c.transaction("write");
  try {
    await tx.execute({ sql: "DELETE FROM inbox_order_items WHERE order_id = ?", args: [id] });
    await tx.execute({ sql: "DELETE FROM inbox_order_history WHERE order_id = ?", args: [id] });
    const r = await tx.execute({ sql: "DELETE FROM inbox_orders WHERE id = ?", args: [id] });
    await tx.commit();
    if (!r.rowsAffected) return bad("Order not found", 404);
    return NextResponse.json({ ok: true });
  } catch (e) {
    await tx.rollback().catch(() => {});
    console.error("inbox delete failed", e);
    return bad("Could not delete the order", 500);
  } finally { tx.close(); }
}

type Tx = Awaited<ReturnType<Awaited<ReturnType<typeof import("@/lib/db").db>>["transaction"]>>;
async function history(tx: Tx, id: number, actor: string, old: Record<string, unknown>, now: Partial<InboxInput>, extra: string) {
  const ev: string[] = [];
  if (now.status !== undefined && now.status !== String(old.status)) ev.push(`Status: ${old.status} → ${now.status}`);
  if (now.payment_status !== undefined && now.payment_status !== String(old.payment_status)) ev.push(`Payment: ${old.payment_status} → ${now.payment_status}`);
  if (now.tracking_number !== undefined && now.tracking_number !== String(old.tracking_number)) ev.push(now.tracking_number ? `Tracking number set to ${now.tracking_number}` : "Tracking number removed");
  if (extra) ev.push(extra);
  for (const e of ev) await tx.execute({ sql: "INSERT INTO inbox_order_history (order_id, event, actor) VALUES (?,?,?)", args: [id, e, actor] });
}
