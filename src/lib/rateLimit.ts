import { db } from "./db";

/**
 * DB-backed fixed-window limiter (works across serverless instances). Returns false once `max` is exceeded.
 * ONE statement per call: an expired window is reset inside the upsert itself, so there is no separate cleanup query on the hot path.
 * Old rows are swept only occasionally (about 1 call in 200), instead of scanning the table on every request.
 */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  const c = await db();
  const now = Math.floor(Date.now() / 1000);
  const r = await c.execute({
    sql: `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
          ON CONFLICT(key) DO UPDATE SET
            count = CASE WHEN reset_at < ? THEN 1 ELSE count + 1 END,
            reset_at = CASE WHEN reset_at < ? THEN ? ELSE reset_at END
          RETURNING count`,
    args: [key, now + windowSec, now, now, now + windowSec],
  });
  if (Math.random() < 0.005) c.execute({ sql: "DELETE FROM rate_limits WHERE reset_at < ?", args: [now] }).catch(() => {});
  return Number(r.rows[0].count) <= max;
}
