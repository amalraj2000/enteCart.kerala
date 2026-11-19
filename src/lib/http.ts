import { NextResponse } from "next/server";

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Parses a JSON object body with a hard size cap. Returns null for anything else (arrays, junk, oversized). */
export async function readJson(req: Request, max = 400_000): Promise<Record<string, unknown> | null> {
  if (Number(req.headers.get("content-length") || 0) > max) return null;
  // Read the body in chunks and stop at the cap, so a huge chunked upload (no Content-Length) is never held in memory.
  let text = "";
  try {
    const reader = req.body?.getReader();
    if (!reader) return null;
    const dec = new TextDecoder(); let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel().catch(() => {}); return null; }
      text += dec.decode(value, { stream: true });
    }
    text += dec.decode();
  } catch { return null; }
  if (!text) return null;
  try {
    const j = JSON.parse(text);
    return j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
  } catch { return null; }
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
