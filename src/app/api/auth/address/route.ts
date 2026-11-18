import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { cleanAddress, firstError, validateAddress } from "@/lib/validate";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await getUser();
  if (!u) return bad("Login required", 401);
  const c = await db();
  const row = (await c.execute({ sql: "SELECT address FROM users WHERE id = ?", args: [u.id] })).rows[0];
  let address = null;
  try { address = row?.address ? JSON.parse(String(row.address)) : null; } catch {}
  return NextResponse.json({ address });
}

export async function PUT(req: Request) {
  const u = await getUser();
  if (!u) return bad("Login required", 401);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const a = cleanAddress(b);
  const err = firstError(validateAddress(a));
  if (err) return bad(err);
  const c = await db();
  await c.execute({ sql: "UPDATE users SET address = ? WHERE id = ?", args: [JSON.stringify(a), u.id] });
  // The address Full Name is the customer's profile name everywhere (header, profile page, checkout).
  await c.execute({ sql: "UPDATE users SET first_name = ?, last_name = '' WHERE id = ?", args: [a.customer_name, u.id] });
  return NextResponse.json({ ok: true });
}
