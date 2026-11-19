import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { CATEGORY_JOIN, VISIBLE } from "@/lib/visibility";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // rebuilt at most hourly

/** Every page Google should know about: the info pages, each active category, and every product customers can actually see. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const c = await db();
  const [cats, products] = await Promise.all([
    c.execute("SELECT c.id FROM categories c WHERE c.status = 'active' AND EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id AND p.status = 'active')"),
    c.execute(`SELECT p.public_id, p.created_at FROM products p ${CATEGORY_JOIN} WHERE ${VISIBLE} AND p.public_id IS NOT NULL ORDER BY p.id DESC LIMIT 45000`),
  ]);
  const at = (s: unknown) => { const d = new Date(String(s).replace(" ", "T") + "Z"); return isNaN(+d) ? undefined : d; };
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    ...["about", "contact", "faq", "shipping-cancellation"].map((p) => ({ url: `${base}/${p}`, changeFrequency: "monthly" as const, priority: 0.3 })),
    ...cats.rows.map((r) => ({ url: `${base}/?category=${r.id}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...products.rows.map((r) => ({ url: `${base}/product/${r.public_id}`, lastModified: at(r.created_at), changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
