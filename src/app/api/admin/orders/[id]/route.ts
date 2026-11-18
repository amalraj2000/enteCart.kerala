import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { editableOrderIds } from "@/lib/permissions";
import { bad, readJson } from "@/lib/http";
import { parseId, validateStatus } from "@/lib/validate";
import { reserveOrder, restockOrder } from "@/lib/orderStock";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid order id");
  const b = await readJson(req);
  if (!b || !validateStatus(b.status)) return bad("Invalid status");
  const next = b.status as string;
  const c = await db();

  const cur = (await c.execute({ sql: "SELECT status FROM orders WHERE id = ?", args: [id] })).rows[0];
  if (!cur) return bad("Order not found", 404);
  if (!(await editableOrderIds(c, me, [id])).has(id)) return bad("You can only update orders that include products you added", 403);
  const prev = String(cur.status);
  if (prev === next) return NextResponse.json({ ok: true });

  // Re-opening a cancelled order takes its items out of stock again — refuse if there isn't enough.
  if (prev === "Cancelled" && !(await reserveOrder(c, id))) return bad("Not enough stock to re-open this cancelled order.", 409);

  // Guarded on the status we just read, so a customer cancelling at the same moment can't be overwritten silently.
  const r = await c.execute({ sql: "UPDATE orders SET status = ? WHERE id = ? AND status = ?", args: [next, id, prev] });
  if (r.rowsAffected !== 1) {
    if (prev === "Cancelled") await restockOrder(c, id); // undo the reservation
    return bad("This order was just changed by someone else — please reload.", 409);
  }
  if (next === "Cancelled") await restockOrder(c, id);
  return NextResponse.json({ ok: true });
}
