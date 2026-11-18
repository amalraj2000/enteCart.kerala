import { db } from "./db";

/** Returns an error message if any uploaded-photo path in `images` doesn't exist in the DB. */
export async function missingUploads(images: string[]): Promise<string | null> {
  const ids = images.map((u) => /^\/api\/images\/(\d+)$/.exec(u)?.[1]).filter(Boolean).map(Number);
  if (!ids.length) return null;
  const c = await db();
  const r = await c.execute({ sql: `SELECT COUNT(*) AS n FROM product_images WHERE id IN (${ids.map(() => "?").join(",")})`, args: ids });
  return Number(r.rows[0].n) === new Set(ids).size ? null : "One of the uploaded photos is missing — please upload it again";
}

export async function categoryExists(id: number): Promise<boolean> {
  const c = await db();
  return (await c.execute({ sql: "SELECT 1 FROM categories WHERE id = ?", args: [id] })).rows.length > 0;
}
