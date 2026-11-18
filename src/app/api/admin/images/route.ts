import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";

const RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/;

/** True only if the decoded bytes really are the image type the data URL claims (no disguised files). */
function magicOk(type: string, b64: string): boolean {
  const h = Buffer.from(b64.slice(0, 24), "base64");
  if (type === "jpeg") return h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
  if (type === "png") return h.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return h.subarray(0, 4).toString("ascii") === "RIFF" && h.subarray(8, 12).toString("ascii") === "WEBP";
}

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
  await c.execute(`DELETE FROM product_images WHERE created_at < datetime('now','-1 day')
    AND NOT EXISTS (SELECT 1 FROM products WHERE instr(products.images, '/api/images/' || product_images.id || '"') > 0)
    AND NOT EXISTS (SELECT 1 FROM orders WHERE instr(orders.items, '/api/images/' || product_images.id || '"') > 0)`);
  return NextResponse.json({ url: `/api/images/${Number(r.lastInsertRowid)}` });
}
