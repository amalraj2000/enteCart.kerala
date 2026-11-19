import { NextResponse } from "next/server";
import { onlinePaymentsEnabled } from "@/lib/settings";
import { razorpayConfigured } from "@/lib/razorpay";
export const dynamic = "force-dynamic";

/** Public: should checkout offer "Pay Online"? (switched on by the owner AND Razorpay keys present). */
export async function GET() {
  return NextResponse.json({ online: razorpayConfigured() && (await onlinePaymentsEnabled()) }, { headers: { "Cache-Control": "no-store" } });
}
