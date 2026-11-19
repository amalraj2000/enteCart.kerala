import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, jsonLd, siteUrl } from "@/lib/site";
import { getHomeData } from "@/lib/catalog";
import type { Category } from "@/lib/types";
import { parseId } from "@/lib/validate";
import ProductCard, { type CardProduct } from "@/components/ProductCard";
import BannerSlider, { type BannerData } from "@/components/BannerSlider";

export const dynamic = "force-dynamic";


function Row({ title, hint, products }: { title: string; hint?: string; products: CardProduct[] }) {
  if (!products.length) return null;
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        {hint && <p className="text-sm text-gray-500">{hint}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{products.map((p, n) => <ProductCard key={p.id} p={p} priority={n < 2} />)}</div>
    </section>
  );
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }): Promise<Metadata> {
  const { q, category } = await searchParams;
  const catId = parseId(category);
  // Search result pages are endless and thin — keep them out of Google. Category pages are real landing pages: index them.
  if (typeof q === "string" && q.trim()) return { title: `Search: ${q.trim().slice(0, 60)} — ${SITE_NAME}`, robots: { index: false, follow: true }, alternates: { canonical: "/" } };
  if (catId) {
    const cat = (await getHomeData("", catId)).cats.find((x) => Number(x.id) === catId);
    if (cat) return { title: `${cat.name} — Buy online in Kerala | ${SITE_NAME}`, description: `Shop ${cat.name} online at ${SITE_NAME}. Cash on Delivery and online payment, delivered across Kerala.`, alternates: { canonical: `/?category=${catId}` } };
  }
  return { alternates: { canonical: "/" } };
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q: rawQ, category: rawCat } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 100) : "";
  const catId = parseId(rawCat);
  const filtered = !!q || !!catId;
  const { cats, products, arrivals, bestRow, banners, showArrivals, showBest } = await getHomeData(q, catId); // cached — see lib/catalog.ts
  const active = cats.find((x) => Number(x.id) === catId);

  const chip = (id: number | null) => `/?${new URLSearchParams({ ...(q ? { q } : {}), ...(id ? { category: String(id) } : {}) }).toString()}`;

  const siteLd = { "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", name: SITE_NAME, url: siteUrl(), logo: `${siteUrl()}/logo.png` },
    { "@type": "WebSite", name: SITE_NAME, url: siteUrl(), potentialAction: { "@type": "SearchAction", target: `${siteUrl()}/?q={search_term_string}`, "query-input": "required name=search_term_string" } },
  ] };
  return (
    <div>
      {!filtered && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(siteLd) }} />}
      {!filtered && (banners.length
        ? <BannerSlider banners={banners} />
        : (
          <section className="mb-6 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-500 p-8 text-white">
            <h1 className="text-3xl font-extrabold">Shop local. Shop Kerala.</h1>
            <p className="mt-2 text-brand-100">Handpicked products delivered to your doorstep in Kerala.</p>
          </section>
        ))}

      {cats.length > 0 && (
        <nav aria-label="Categories" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: null, name: "All" }, ...cats].map((x) => {
            const on = (x.id === null && !catId) || Number(x.id) === catId;
            return (
              <Link key={x.id ?? "all"} href={chip(x.id === null ? null : Number(x.id))}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${on ? "border-brand-600 bg-brand-600 text-white" : "border-gray-300 bg-white hover:border-brand-600 hover:text-brand-700"}`}>
                {x.name}
              </Link>
            );
          })}
        </nav>
      )}

      {!filtered && showArrivals && <Row title="✨ New arrivals" hint="Fresh in the shop" products={arrivals} />}
      {!filtered && showBest && <Row title="🔥 Best sellers" hint="Most loved by our customers" products={bestRow} />}

      <h2 className="mb-4 text-xl font-bold">{q ? `Results for “${q}”` : active ? active.name : "All products"}{q && active ? ` in ${active.name}` : ""} <span className="text-sm font-normal text-gray-500">({products.length})</span></h2>
      {products.length === 0 && <p className="text-gray-500">No products found.</p>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}
