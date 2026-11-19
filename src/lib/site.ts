/** Public address of the shop, used for canonical links, the sitemap and structured data. Set SITE_URL (e.g. https://entecart.kerala.in) in production. */
export function siteUrl(): string {
  const v = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") || "http://localhost:3000";
  return v.replace(/\/+$/, "");
}
export const SITE_NAME = "enteCart.kerala";

/** One-line plain-text description: collapses whitespace, cuts at a word near `max` chars. */
export function snippet(text: string, max = 155): string {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}
/** JSON for a <script type="application/ld+json">; "<" is escaped so nothing in a product title can close the tag. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
