import * as webpush from "web-push";
import type { Client } from "@libsql/client";

export type PushPayload = { title: string; body: string; url: string; tag?: string };

let ready: boolean | null = null;
/** Web push needs VAPID keys (see .env.example). Without them every push call is a quiet no-op. */
export function pushEnabled(): boolean {
  if (ready !== null) return ready;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (ready = false);
  try { webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv); ready = true; }
  catch (e) { console.error("Invalid VAPID keys:", (e as Error).message); ready = false; }
  return ready;
}

/** Sends a phone notification to every device this user enabled. Best effort: NEVER throws. Dead subscriptions (404/410) are removed. */
export async function sendPush(c: Client, userId: number, p: PushPayload): Promise<void> {
  if (!pushEnabled()) return;
  try {
    const subs = (await c.execute({ sql: "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?", args: [userId] })).rows;
    const body = JSON.stringify({ title: p.title.slice(0, 120), body: p.body.slice(0, 300), url: p.url, tag: p.tag });
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: String(s.endpoint), keys: { p256dh: String(s.p256dh), auth: String(s.auth) } }, body, { TTL: 86400, timeout: 4000 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await c.execute({ sql: "DELETE FROM push_subscriptions WHERE id = ?", args: [Number(s.id)] }).catch(() => {});
      }
    }));
  } catch (e) { console.error("Push failed:", (e as Error).message); }
}
