import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { getSavedAddress, saveAddress } from "@/lib/addresses";
import { cleanAddress, firstError, validateAddress } from "@/lib/validate";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await getUser();
  if (!u) return bad("Login required", 401);
  const c = await db();
  const a = await getSavedAddress(c, u.id);
  return NextResponse.json({ address: a ? { customer_name: a.customer_name, phone: a.phone, house_name: a.house_name, street_name: a.street_name, city: a.city, state: a.state, pincode: a.pincode } : null });
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
  await saveAddress(c, u.id, a); // also keeps users.name equal to this Full Name
  return NextResponse.json({ ok: true });
}
