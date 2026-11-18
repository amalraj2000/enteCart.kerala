import sharp from "sharp";
import { db } from "@/lib/db";
import { parseId } from "@/lib/validate";
import { IMG_WIDTHS } from "@/lib/imgSrc";

const CACHE = "public, max-age=31536000, immutable"; // ids never change, so browsers and the CDN can keep every version for a year

/**
 * Serves an uploaded product photo. Public (shoppers need it).
 * `?w=320` returns a resized WebP (only the widths in IMG_WIDTHS); without it, the original upload.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return new Response("Not found", { status: 404 });
  const c = await db();
  const row = (await c.execute({ sql: "SELECT data FROM product_images WHERE id = ?", args: [id] })).rows[0];
  const m = row && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(row.data));
  if (!m) return new Response("Not found", { status: 404 });
  const original = Buffer.from(m[2], "base64");
  const headers = { "Cache-Control": CACHE, "X-Content-Type-Options": "nosniff" };

  const w = Number(new URL(req.url).searchParams.get("w"));
  if (w && (IMG_WIDTHS as readonly number[]).includes(w)) {
    try {
      const out = await sharp(original).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      return new Response(new Uint8Array(out), { headers: { ...headers, "Content-Type": "image/webp", Vary: "Accept" } });
    } catch { /* fall through: serve the original rather than a broken picture */ }
  }
  return new Response(new Uint8Array(original), { headers: { ...headers, "Content-Type": m[1] } });
}
