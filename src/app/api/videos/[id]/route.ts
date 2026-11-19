import { db } from "@/lib/db";
import { parseId } from "@/lib/validate";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes" };

/** Serves an uploaded product video (public). Supports Range requests, which Safari/iOS need to play video. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return new Response("Not found", { status: 404 });
  const row = (await (await db()).execute({ sql: "SELECT mime, data FROM product_videos WHERE id = ?", args: [id] })).rows[0];
  if (!row) return new Response("Not found", { status: 404 });
  const buf = Buffer.from(row.data as ArrayBuffer), size = buf.length, mime = String(row.mime);
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2])), end = m[1] && m[2] ? Number(m[2]) : size - 1;
    end = Math.min(end, size - 1);
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { ...H, "Content-Range": `bytes */${size}` } });
    return new Response(new Uint8Array(buf.subarray(start, end + 1)), { status: 206, headers: { ...H, "Content-Type": mime, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  return new Response(new Uint8Array(buf), { headers: { ...H, "Content-Type": mime, "Content-Length": String(size) } });
}
