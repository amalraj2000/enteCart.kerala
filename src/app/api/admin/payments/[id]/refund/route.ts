import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/session";
import { bad } from "@/lib/http";
import { parseId } from "@/lib/validate";
import { refundOrder } from "@/lib/refund";

/** Super admin only: refunds a cancelled, paid online order in full to the customer's original payment method. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSuperAdmin())) return bad("Only the super admin can refund payments", 403);
  const id = parseId((await params).id);
  if (!id) return bad("Payment not found", 404);
  const c = await db();
  const p = (await c.execute({
    sql: "SELECT p.*, o.status AS order_status FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ?", args: [id],
  })).rows[0];
  if (!p) return bad("Payment not found", 404);
  if (p.status !== "Paid") return bad(p.status === "Refunded" ? "Already refunded" : "This payment was never completed", 409);
  if (p.order_status !== "Cancelled") return bad("Cancel the order first, then refund it.", 409);

  const r = await refundOrder(c, Number(p.order_id));
  return r.ok ? NextResponse.json({ ok: true, refundId: r.refundId }) : bad(r.error, 502);
}
