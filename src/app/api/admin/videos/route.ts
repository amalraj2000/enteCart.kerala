import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { bad } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
const VIDEO_MAX_BYTES = 4_000_000; // Vercel rejects request bodies over 4.5 MB, so 4 MB is the practical ceiling

/** Real file type from the first bytes (the Content-Type header can lie). */
function sniff(h: Buffer): "video/mp4" | "video/webm" | null {
  if (h.subarray(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  if (h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3) return "video/webm";
  return null;
}

/** Admin uploads one short product video as the raw request body. Returns the link to store in products.video_url. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  if (!(await rateLimit("admin-video", 20, 600))) return bad("Too many uploads. Please wait a few minutes.", 429);
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > VIDEO_MAX_BYTES) return bad("Video is too large (max 4 MB)", 413);
  // Read in chunks and stop at the cap, so a chunked upload with no Content-Length can't fill memory.
  const chunks: Uint8Array[] = []; let got = 0;
  try {
    const reader = req.body?.getReader();
    if (reader) for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.byteLength;
      if (got > VIDEO_MAX_BYTES) { await reader.cancel().catch(() => {}); return bad("Video is too large (max 4 MB)", 413); }
      chunks.push(value);
    }
  } catch { return bad("No video received"); }
  const buf = Buffer.concat(chunks);
  if (!buf.length) return bad("No video received");
  const type = sniff(buf);
  if (!type) return bad("Only MP4 or WebM videos are allowed");

  const c = await db();
  const r = await c.execute({ sql: "INSERT INTO product_videos (mime, data) VALUES (?, ?)", args: [type, buf] });
  // Housekeeping: drop uploads older than a day that no product uses (abandoned forms, replaced or deleted products).
  if (Math.random() < 0.05) await c.execute(`DELETE FROM product_videos WHERE created_at < datetime('now','-1 day')
    AND NOT EXISTS (SELECT 1 FROM products WHERE products.video_url = '/api/videos/' || product_videos.id)`);
  return NextResponse.json({ url: `/api/videos/${Number(r.lastInsertRowid)}` });
}
