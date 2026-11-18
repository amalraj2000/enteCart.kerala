import { NextResponse, type NextRequest } from "next/server";

/** CSRF defence: state-changing API calls must come from this site (Origin / Sec-Fetch-Site check). */
export function middleware(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return NextResponse.next();
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  const host = req.headers.get("host");
  let ok = true;
  if (origin) { try { ok = new URL(origin).host === host; } catch { ok = false; } }
  else if (site) ok = site === "same-origin" || site === "none";
  if (!ok) return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
  return NextResponse.next();
}
export const config = { matcher: "/api/:path*" };
