import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { withImages } from "@/lib/orderItems";
import { bad } from "@/lib/http";
import { parseId } from "@/lib/validate";
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
