import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { WELCOME_OFF, welcomeEligible } from "@/lib/welcome";
export const dynamic = "force-dynamic";

/** Does this customer still have the first-order voucher? */
export async function GET() {
  const user = await getUser();
  const eligible = !!user && (await welcomeEligible(await db(), user.id));
  return NextResponse.json({ eligible, amount: WELCOME_OFF }, { headers: { "Cache-Control": "no-store" } });
}
