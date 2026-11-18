import Link from "next/link";
import { db } from "@/lib/db";
import type { Category } from "@/lib/types";
import { parseId } from "@/lib/validate";
import ProductCard, { type CardProduct } from "@/components/ProductCard";
import BannerSlider, { type BannerData } from "@/components/BannerSlider";
import TrustStrip from "@/components/TrustStrip";

export const dynamic = "force-dynamic";

const NEW_DAYS = 14;          // a product is "New" for this many days after being added
const BEST_MIN_UNITS = 3;     // units sold before a product earns the "Best seller" badge

function Row({ title, hint, products }: { title: string; hint?: string; products: CardProduct[] }) {
  if (!products.length) return null;
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        {hint && <p className="text-sm text-gray-500">{hint}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
    </section>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q: rawQ, category: rawCat } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 100) : "";
  const catId = parseId(rawCat);
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`; // escape LIKE wildcards
  const filtered = !!q || !!catId;
  const c = await db();

  const cats = (await c.execute("SELECT c.id, c.name, COUNT(p.id) AS count FROM categories c JOIN products p ON p.category_id = c.id GROUP BY c.id ORDER BY c.name")).rows as unknown as Category[];
  const active = cats.find((x) => Number(x.id) === catId);

  const where: string[] = [];
  const args: (string | number)[] = [];
  if (q) { where.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')"); args.push(like, like); }
  if (catId) { where.push("category_id = ?"); args.push(catId); }

  // Units sold per product (non-cancelled orders) → "Best seller" badge + row.
  const sold = (await c.execute(`SELECT p.*, SUM(oi.qty) AS units FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
                                 WHERE o.status != 'Cancelled' GROUP BY p.id ORDER BY units DESC, p.id DESC LIMIT 8`)).rows as unknown as (CardProduct & { units: number })[];
  const bestIds = new Set(sold.filter((s) => Number(s.units) >= BEST_MIN_UNITS).slice(0, 4).map((s) => Number(s.id)));
  const isNewSql = `(created_at >= datetime('now', '-${NEW_DAYS} days')) AS is_new`;

  const products = (await c.execute({ sql: `SELECT *, ${isNewSql} FROM products ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC`, args })).rows as unknown as CardProduct[];
  const mark = (p: CardProduct): CardProduct => ({ ...JSON.parse(JSON.stringify(p)), best: bestIds.has(Number(p.id)) });

  const banners = filtered ? [] : ((await c.execute("SELECT id, title, subtitle, button_text, link, image FROM banners WHERE active = 1 ORDER BY position, id")).rows as unknown as BannerData[]);
  const arrivals = filtered ? [] : ((await c.execute(`SELECT *, ${isNewSql} FROM products ORDER BY created_at DESC, id DESC LIMIT 4`)).rows as unknown as CardProduct[]);
  const bestRow = filtered ? [] : sold.filter((s) => Number(s.units) > 0).slice(0, 4);
  const newIds = new Set(products.filter((p) => p.is_new).map((p) => Number(p.id)));

  const chip = (id: number | null) => `/?${new URLSearchParams({ ...(q ? { q } : {}), ...(id ? { category: String(id) } : {}) }).toString()}`;

  return (
    <div>
      {!filtered && (banners.length
        ? <BannerSlider banners={JSON.parse(JSON.stringify(banners))} />
        : (
          <section className="mb-6 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-500 p-8 text-white">
            <h1 className="text-3xl font-extrabold">Shop local. Pay on delivery.</h1>
            <p className="mt-2 text-brand-100">Handpicked products delivered to your doorstep in Kerala.</p>
          </section>
        ))}
      {!filtered && <TrustStrip />}

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

      {!filtered && <Row title="✨ New arrivals" hint="Fresh in the shop" products={arrivals.map((p) => ({ ...mark(p), is_new: p.is_new }))} />}
      {!filtered && <Row title="🔥 Best sellers" hint="Most loved by our customers" products={bestRow.map((p) => ({ ...mark(p), is_new: newIds.has(Number(p.id)) ? 1 : 0 }))} />}

      <h2 className="mb-4 text-xl font-bold">{q ? `Results for “${q}”` : active ? active.name : "All products"}{q && active ? ` in ${active.name}` : ""} <span className="text-sm font-normal text-gray-500">({products.length})</span></h2>
      {products.length === 0 && <p className="text-gray-500">No products found.</p>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => <ProductCard key={p.id} p={mark(p)} />)}
      </div>
    </div>
  );
}
