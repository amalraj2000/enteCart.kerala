import { NextResponse } from "next/server";
import { revalidateCatalogSoon } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { withImages } from "@/lib/orderItems";
import { bad, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { parseId } from "@/lib/validate";
import { CANCELLABLE_STATUS } from "@/lib/orderPolicy";
import { reconcilePayment } from "@/lib/reconcilePayment";
import { refundOrder } from "@/lib/refund";
import { restockOrder } from "@/lib/orderStock";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return bad("Login required", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Order not found", 404);
  const c = await db();
  // user_id is part of the WHERE clause: customers can never read someone else's order.
  const r = await c.execute({ sql: "SELECT * FROM orders WHERE id = ? AND user_id = ?", args: [id, user.id] });
  if (!r.rows[0]) return bad("Order not found", 404);
  // If the customer paid but left before we recorded it, confirm with Razorpay and fix the status.
  if (r.rows[0].payment_status === "Unpaid" && (await rateLimit(`recon:${id}`, 2, 30))) { // at most 2 Razorpay look-ups per order per 30 s
    await reconcilePayment(c, id);
    const fresh = await c.execute({ sql: "SELECT * FROM orders WHERE id = ? AND user_id = ?", args: [id, user.id] });
    return NextResponse.json({ order: (await withImages(fresh.rows))[0] });
  }
  return NextResponse.json({ order: (await withImages(r.rows))[0] });
}

/** Customer cancels their own order — allowed only while it is still "Placed". */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return bad("Login required", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Order not found", 404);
  const b = await readJson(req);
  if (!b || b.action !== "cancel") return bad("Invalid request");

  const c = await db();
  // An online order may have been paid without our browser hearing about it — settle that first so we know whether a refund is due.
  const pay = (await c.execute({ sql: "SELECT payment_method FROM orders WHERE id = ? AND user_id = ?", args: [id, user.id] })).rows[0];
  const online = pay?.payment_method === "online";
  if (online) await reconcilePayment(c, id);
  // One guarded UPDATE decides it: if an admin confirmed the order a moment ago, this changes nothing.
  const r = await c.execute({ sql: "UPDATE orders SET status = 'Cancelled' WHERE id = ? AND user_id = ? AND status = ?", args: [id, user.id, CANCELLABLE_STATUS] });
  if (r.rowsAffected !== 1) {
    const o = (await c.execute({ sql: "SELECT status FROM orders WHERE id = ? AND user_id = ?", args: [id, user.id] })).rows[0];
    if (!o) return bad("Order not found", 404);
    return bad(o.status === "Cancelled" ? "This order is already cancelled." : `This order is ${String(o.status)} and can no longer be cancelled.`, 409);
  }
  await restockOrder(c, id); // the items go back on sale
  revalidateCatalogSoon();
  if (!online) return NextResponse.json({ ok: true });
  await reconcilePayment(c, id); // a payment that landed during the cancel is picked up (and refunded) here
  // Paid online → automatic full refund to the original payment method. If Razorpay hiccups, the order is still cancelled
  // and shows as "Refund due" in Admin → Payments, where the refund can be retried with one click.
  const rf = await refundOrder(c, id);
  return NextResponse.json({ ok: true, refund: rf.ok ? "done" : "pending" });
}
