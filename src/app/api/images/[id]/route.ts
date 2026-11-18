import { db } from "@/lib/db";
import { parseId } from "@/lib/validate";

/** Serves an uploaded product photo. Public (shoppers need it); ids never change so it's cached for a year. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return new Response("Not found", { status: 404 });
  const c = await db();
  const row = (await c.execute({ sql: "SELECT data FROM product_images WHERE id = ?", args: [id] })).rows[0];
  const m = row && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(row.data));
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
