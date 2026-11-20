import type { MetadataRoute } from "next";
import { getTheme } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Web app manifest → makes the shop installable ("Add to Home screen") and gives it an app-like window. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  return {
    id: "/",
    name: "enteCart.kerala — Shop local, shop Kerala",
    short_name: "enteCart",
    description: "Kerala's friendly online store. Handpicked products delivered to your doorstep.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: (await getTheme()).shades[600],
    lang: "en-IN",
    categories: ["shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My cart", url: "/cart", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My orders", url: "/orders", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
