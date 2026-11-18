import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { withImages } from "@/lib/orderItems";
import { bad, readJson } from "@/lib/http";
import { parseId } from "@/lib/validate";
import { CANCELLABLE_STATUS } from "@/lib/orderPolicy";
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
  // One guarded UPDATE decides it: if an admin confirmed the order a moment ago, this changes nothing.
  const r = await c.execute({ sql: "UPDATE orders SET status = 'Cancelled' WHERE id = ? AND user_id = ? AND status = ?", args: [id, user.id, CANCELLABLE_STATUS] });
  if (r.rowsAffected !== 1) {
    const o = (await c.execute({ sql: "SELECT status FROM orders WHERE id = ? AND user_id = ?", args: [id, user.id] })).rows[0];
    if (!o) return bad("Order not found", 404);
    return bad(o.status === "Cancelled" ? "This order is already cancelled." : `This order is ${String(o.status)} and can no longer be cancelled.`, 409);
  }
  await restockOrder(c, id); // the items go back on sale
  return NextResponse.json({ ok: true });
}
