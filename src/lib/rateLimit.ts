import { db } from "./db";

/** DB-backed fixed-window limiter (works across serverless instances). Returns false once `max` is exceeded. */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  const c = await db();
  const now = Math.floor(Date.now() / 1000);
  await c.execute({ sql: "DELETE FROM rate_limits WHERE reset_at < ?", args: [now] });
  const r = await c.execute({
    sql: "INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count",
    args: [key, now + windowSec],
  });
  return Number(r.rows[0].count) <= max;
}
