const security = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  // Full policy in REPORT-ONLY mode first: nothing is blocked, but the browser console lists anything it would block.
  // Once a normal shopping + checkout + admin session shows no violations, rename the key to "Content-Security-Policy".
  { key: "Content-Security-Policy-Report-Only", value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com; frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.youtube-nocookie.com https://player.vimeo.com; media-src 'self' https:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
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
