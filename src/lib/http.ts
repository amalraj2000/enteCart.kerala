import { NextResponse } from "next/server";

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Parses a JSON object body with a hard size cap. Returns null for anything else (arrays, junk, oversized). */
export async function readJson(req: Request, max = 400_000): Promise<Record<string, unknown> | null> {
  if (Number(req.headers.get("content-length") || 0) > max) return null;
  const text = await req.text().catch(() => "");
  if (!text || text.length > max) return null;
  try {
    const j = JSON.parse(text);
    return j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
  } catch { return null; }
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
