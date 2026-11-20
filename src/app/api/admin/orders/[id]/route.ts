import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { parseId, validateStatus } from "@/lib/validate";
import { changeOrderStatus } from "@/lib/orderStatus";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid order id");
  const b = await readJson(req);
  if (!b || !validateStatus(b.status)) return bad("Invalid status");
  const r = await changeOrderStatus(await db(), id, b.status as string, me); // all the rules live in lib/orderStatus.ts
  return r.ok ? NextResponse.json({ ok: true }) : bad(r.error, r.status);
}
