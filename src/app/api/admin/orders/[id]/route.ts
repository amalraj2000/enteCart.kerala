import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { parseId, validateStatus } from "@/lib/validate";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid order id");
  const b = await readJson(req);
  if (!b || !validateStatus(b.status)) return bad("Invalid status");
  const c = await db();
  const r = await c.execute({ sql: "UPDATE orders SET status = ? WHERE id = ?", args: [b.status as string, id] });
  if (!r.rowsAffected) return bad("Order not found", 404);
  return NextResponse.json({ ok: true });
}
