import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin, getUser } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
export const dynamic = "force-dynamic";

/** Who is calling: scope "admin" = the staff session, otherwise the customer session. */
async function who(scope: unknown): Promise<number | null> {
  if (scope === "admin") return (await getAdmin())?.id ?? null;
  return (await getUser())?.id ?? null;
}
const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);

/** POST { scope, subscription } — save (or move to the current user) this device's push subscription. */
export async function POST(req: Request) {
  const b = await readJson(req);
  const sub = b?.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
  const endpoint = str(sub?.endpoint, 1000), p256dh = str(sub?.keys?.p256dh, 200), auth = str(sub?.keys?.auth, 100);
  if (!endpoint || !p256dh || !auth || !endpoint.startsWith("https://")) return bad("Invalid subscription");
  const uid = await who(b?.scope);
  if (!uid) return bad("Login required", 401);
  await (await db()).execute({
    sql: "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth",
    args: [uid, endpoint, p256dh, auth],
  });
  return NextResponse.json({ ok: true });
}

/** DELETE { endpoint } — stop notifications on this device (called on logout). The endpoint itself is the secret, so no login is needed. */
export async function DELETE(req: Request) {
  const b = await readJson(req);
  const endpoint = str(b?.endpoint, 1000);
  if (!endpoint) return bad("Invalid request");
  await (await db()).execute({ sql: "DELETE FROM push_subscriptions WHERE endpoint = ?", args: [endpoint] });
  return NextResponse.json({ ok: true });
}
