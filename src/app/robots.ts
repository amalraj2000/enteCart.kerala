import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic"; // read SITE_URL at request time

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/cart", "/checkout", "/orders", "/order-success", "/account", "/wishlist", "/offline", "/api/auth", "/api/admin", "/api/orders", "/api/payments"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
