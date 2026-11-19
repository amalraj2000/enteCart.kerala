import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SHOP_VENDOR } from "@/lib/staffLabel";
import { getProduct, publicIdForLegacyId } from "@/lib/catalog";
import { permanentRedirect } from "next/navigation";
import { isPublicId } from "@/lib/publicId";
import { discountPct, inr, productImages, type Product } from "@/lib/types";
import Gallery from "@/components/Gallery";
import WishlistButton from "@/components/WishlistButton";
import BuyPanel from "@/components/BuyPanel";
import ShareButton from "@/components/ShareButton";
import { SITE_NAME, jsonLd, siteUrl, snippet } from "@/lib/site";

export const dynamic = "force-dynamic";

const photo = (u: string) => (/^\/api\/images\/\d+$/.test(u) ? `${u}?w=1000` : u);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = isPublicId(id) ? ((await getProduct(id)) as unknown as (Product & { category_name?: string | null }) | null) : null;
  if (!p) return { title: "Product not found", robots: { index: false, follow: false } };
  const off = discountPct(p.price, p.original_price);
  const title = `${p.title} — ${inr(p.price)}${p.category_name ? ` | ${p.category_name}` : ""} — ${SITE_NAME}`;
  const description = snippet(`${p.title} for ${inr(p.price)}${off ? ` (${off}% off)` : ""}${p.category_name ? ` in ${p.category_name}` : ""}. ${p.description || ""} Cash on Delivery & online payment. Delivered across Kerala.`);
  const imgs = productImages(p).slice(0, 4).map((u) => ({ url: photo(u) }));
  return {
    title: { absolute: title }, description,
    alternates: { canonical: `/product/${p.public_id}` },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN", title: p.title, description, url: `/product/${p.public_id}`, images: imgs },
    twitter: { card: "summary_large_image", title: p.title, description, images: imgs.map((i) => i.url) },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Old numeric links (/product/12) redirect permanently to the product's opaque address.
  if (/^\d{1,12}$/.test(id)) { const pid = await publicIdForLegacyId(Number(id)); if (pid) permanentRedirect(`/product/${pid}`); notFound(); }
  if (!isPublicId(id)) notFound();
  const p = (await getProduct(id)) as unknown as (Product & { category_name?: string | null }) | null; // cached — see lib/catalog.ts
  if (!p) notFound();
  const base = siteUrl();
  const abs = (u: string) => (u.startsWith("/") ? base + u : u);
  const ld = {
    "@context": "https://schema.org", "@type": "Product",
    name: p.title, description: snippet(p.description || p.title, 500), sku: String(p.id),
    image: productImages(p).map((u) => abs(photo(u))),
    ...(p.category_name ? { category: p.category_name } : {}),
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer", url: `${base}/product/${p.public_id}`, priceCurrency: "INR", price: Number(p.price).toFixed(2),
      availability: Number(p.stock) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  };
  return (<>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
    <div className="card grid grid-cols-1 gap-8 p-4 md:grid-cols-2 md:p-8">
      <Gallery images={productImages(p)} alt={p.title} />
      <div className="min-w-0">
        {p.category_name && <Link href={`/?category=${p.category_id}`} className="mb-2 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">{p.category_name}</Link>}
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{p.title}</h1>
          <div className="flex shrink-0 items-center gap-2"><ShareButton title={p.title} price={inr(p.price)} publicId={String(p.public_id)} /><WishlistButton productId={p.id} variant="inline" /></div>
        </div>
        <p className="mt-1 text-sm text-gray-500">Sold by <span className="font-semibold text-gray-700">{SHOP_VENDOR}</span></p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-3xl font-extrabold text-brand-700">{inr(p.price)}</p>
          {discountPct(p.price, p.original_price) > 0 && <>
            <p className="text-lg text-gray-400 line-through">{inr(Number(p.original_price))}</p>
            <p className="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-bold text-green-700">{discountPct(p.price, p.original_price)}% off</p>
          </>}
        </div>
        {discountPct(p.price, p.original_price) > 0 && <p className="text-sm font-medium text-green-700">You save {inr(Number(p.original_price) - p.price)}</p>}
        <p className="mt-4 whitespace-pre-line text-gray-700">{p.description}</p>
        <BuyPanel product={p} />
      </div>
    </div>
  </>);
}
