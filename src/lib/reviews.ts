import type { Client } from "@libsql/client";
import { db } from "./db";
import { customerNameSql } from "./userName";

/** Owner's master switch (Admin → Reviews). Stored in `settings` as "1"/"0"; missing = ON. Not part of SETTING_KEYS, so the shop-details form can't flip it. */
export const REVIEWS_KEY = "reviews_enabled";
export const REVIEWS_PAGE = 2; // reviews shown per batch on the product page ("Load more" fetches the next batch)

export async function reviewsEnabled(c?: Client): Promise<boolean> {
  const r = (await (c ?? (await db())).execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [REVIEWS_KEY] })).rows[0];
  return String(r?.value ?? "1") !== "0";
}

export type PublicReview = { id: number; name: string; rating: number; comment: string; created_at: string; images: string[] };
export type MyReview = { id: number; product_id: number; rating: number; comment: string; status: string; active: boolean; created_at: string; images: string[] };
export type ReviewSummary = { avg: number; count: number };

/** Short public name: first name + initial of the rest ("Anitha K."). Falls back to "Customer". */
export function displayName(full: unknown): string {
  const p = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "Customer";
  return p.length === 1 ? p[0] : `${p[0]} ${p[p.length - 1][0].toUpperCase()}.`;
}

/** Attaches each review's photo urls (one query for all). */
export async function withPhotos<T extends { id: number }>(c: Client, rows: T[]): Promise<(T & { images: string[] })[]> {
  if (!rows.length) return [];
  const imgs = (await c.execute({ sql: `SELECT id, review_id FROM review_images WHERE review_id IN (${rows.map(() => "?").join(",")}) ORDER BY id`, args: rows.map((r) => r.id) })).rows;
  const by = new Map<number, string[]>();
  for (const i of imgs) by.set(Number(i.review_id), [...(by.get(Number(i.review_id)) ?? []), `/api/review-images/${Number(i.id)}`]);
  return rows.map((r) => ({ ...r, images: by.get(r.id) ?? [] }));
}

/** Approved AND active reviews only — the only ones shoppers ever see. Newest first. */
export async function approvedReviews(productId: number, offset: number, limit = REVIEWS_PAGE): Promise<{ reviews: PublicReview[]; hasMore: boolean }> {
  const c = await db();
  const rows = (await c.execute({
    sql: `SELECT r.id, r.rating, r.comment, r.created_at, ${customerNameSql("u")} AS name
          FROM reviews r JOIN users u ON u.id = r.user_id
          WHERE r.product_id = ? AND r.status = 'approved' AND r.active = 1 ORDER BY r.id DESC LIMIT ? OFFSET ?`,
    args: [productId, limit + 1, offset], // one extra row tells us whether "Load more" is needed
  })).rows;
  const page = rows.slice(0, limit).map((r) => ({ id: Number(r.id), name: displayName(r.name), rating: Number(r.rating), comment: String(r.comment), created_at: String(r.created_at) }));
  return { reviews: await withPhotos(c, page), hasMore: rows.length > limit };
}

export async function reviewSummary(productId: number): Promise<ReviewSummary> {
  const r = (await (await db()).execute({ sql: "SELECT COUNT(*) AS n, AVG(rating) AS a FROM reviews WHERE product_id = ? AND status = 'approved' AND active = 1", args: [productId] })).rows[0];
  return { count: Number(r.n), avg: r.a === null ? 0 : Math.round(Number(r.a) * 10) / 10 };
}

/** Did this customer receive (status Delivered) an order containing the product? The ONLY way to earn the right to review it. */
/** An approved review is final: the customer can no longer edit or delete it (the shop can still moderate it). */
export const LOCKED_MESSAGE = "An approved review can no longer be edited or deleted. Please contact the shop if something is wrong.";

export async function deliveredOrderFor(c: Client, userId: number, productId: number): Promise<number | null> {
  const r = (await c.execute({
    sql: `SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id = o.id
          WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'Delivered' ORDER BY o.id DESC LIMIT 1`,
    args: [userId, productId],
  })).rows[0];
  return r ? Number(r.id) : null;
}

/** Links the submitted photo urls to the review (only the customer's own, not already used elsewhere) and removes photos they dropped. Returns an error text, or null. */
export async function attachPhotos(c: Client, userId: number, reviewId: number, urls: string[]): Promise<string | null> {
  const ids = urls.map((u) => Number(/^\/api\/review-images\/(\d+)$/.exec(u)![1]));
  if (ids.length) {
    const ok = (await c.execute({ sql: `SELECT COUNT(*) AS n FROM review_images WHERE user_id = ? AND (review_id IS NULL OR review_id = ?) AND id IN (${ids.map(() => "?").join(",")})`, args: [userId, reviewId, ...ids] })).rows[0].n;
    if (Number(ok) !== ids.length) return "A photo is missing — please upload it again";
  }
  await c.batch([
    { sql: `DELETE FROM review_images WHERE review_id = ? ${ids.length ? `AND id NOT IN (${ids.map(() => "?").join(",")})` : ""}`, args: [reviewId, ...ids] },
    ...(ids.length ? [{ sql: `UPDATE review_images SET review_id = ? WHERE user_id = ? AND id IN (${ids.map(() => "?").join(",")})`, args: [reviewId, userId, ...ids] }] : []),
  ], "write");
  return null;
}
