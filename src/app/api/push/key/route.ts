import { NextResponse } from "next/server";
import { pushEnabled } from "@/lib/push";
export const dynamic = "force-dynamic";

/** The public VAPID key the browser needs to subscribe (empty when push is not configured). */
export async function GET() {
  return NextResponse.json({ key: pushEnabled() ? process.env.VAPID_PUBLIC_KEY : "" });
}
