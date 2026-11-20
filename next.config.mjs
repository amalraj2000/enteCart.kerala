// `next dev` needs eval() (React refresh / error overlays) and a websocket for hot reload, so the policy is relaxed ONLY there.
// Production builds keep the strict policy: no 'unsafe-eval', no ws:.
const dev = process.env.NODE_ENV !== "production";

const security = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Enforced policy. Everything the shop loads is listed: own site, Razorpay (script, popup frame, API), YouTube/Vimeo frames, https photos/videos.
  // 'unsafe-inline' scripts/styles are required by Next.js (no nonces set up). If a new third-party service is added, add its domain here.
  { key: "Content-Security-Policy", value: `default-src 'self'; script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self'${dev ? " ws://localhost:* ws://127.0.0.1:*" : ""} https://api.razorpay.com https://lumberjack.razorpay.com https://checkout.razorpay.com; frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.youtube-nocookie.com https://player.vimeo.com; media-src 'self' https:; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self' https://api.razorpay.com` },
];

// The service worker must always be re-checked by the browser, or a bad version could get stuck for a day.
const sw = [
  { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
  { key: "Content-Type", value: "application/javascript; charset=utf-8" },
];

// Private / transactional pages must never appear in Google (the page code for several of them is client-side, so this is done with a header).
const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
const PRIVATE = ["/admin/:path*", "/cart", "/checkout", "/orders/:path*", "/orders", "/order-success/:path*", "/account", "/wishlist", "/offline", "/api/:path((?!images/).*)"];

/** @type {import('next').NextConfig} */
export default {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: security }, { source: "/sw.js", headers: sw }, ...PRIVATE.map((source) => ({ source, headers: noindex }))];
  },
};
