import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";
export async function POST() {
  await clearSession("user");
  return NextResponse.json({ ok: true });
}
