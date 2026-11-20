import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { IMAGE_DATA_RE, magicOk } from "@/lib/imageData";

const RE = IMAGE_DATA_RE;

export async function POST(req: Request) {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  if (!(await rateLimit("admin-upload", 60, 600))) return bad("Too many uploads. Please wait a few minutes.", 429);
  const b = await readJson(req, 650_000);
  if (!b || typeof b.data !== "string") return bad("Invalid request");
  const m = RE.exec(b.data);
  if (!m || b.data.length > 450_000) return bad("Invalid or too large image (max ~330 KB after compression)");
  if (!magicOk(m[1], m[2])) return bad("File is not a valid image");

  const c = await db();
  const r = await c.execute({ sql: "INSERT INTO product_images (data) VALUES (?)", args: [b.data] });
  // Housekeeping: drop uploads older than a day that no product or past order uses (e.g. abandoned forms).
  if (Math.random() < 0.05) await c.execute(`DELETE FROM product_images WHERE created_at < datetime('now','-1 day')
    AND NOT EXISTS (SELECT 1 FROM products WHERE instr(products.images, '/api/images/' || product_images.id || '"') > 0)
    AND NOT EXISTS (SELECT 1 FROM order_items WHERE order_items.image_url = '/api/images/' || product_images.id)
    AND NOT EXISTS (SELECT 1 FROM banners WHERE banners.image = '/api/images/' || product_images.id)`);
  return NextResponse.json({ url: `/api/images/${Number(r.lastInsertRowid)}` });
}
