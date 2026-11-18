import Link from "next/link";
import { db } from "@/lib/db";
import { inr, productImages, type Category, type Product } from "@/lib/types";
import { parseId } from "@/lib/validate";
import CardSlideshow from "@/components/CardSlideshow";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q: rawQ, category: rawCat } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 100) : "";
  const catId = parseId(rawCat);
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`; // escape LIKE wildcards
  const c = await db();

  const cats = (await c.execute("SELECT c.id, c.name, COUNT(p.id) AS count FROM categories c JOIN products p ON p.category_id = c.id GROUP BY c.id ORDER BY c.name")).rows as unknown as Category[];
  const active = cats.find((x) => Number(x.id) === catId);

  const where: string[] = [];
  const args: (string | number)[] = [];
  if (q) { where.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')"); args.push(like, like); }
  if (catId) { where.push("category_id = ?"); args.push(catId); }
  const r = await c.execute({ sql: `SELECT * FROM products ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC`, args });
  const products = r.rows as unknown as Product[];
  const chip = (id: number | null) => `/?${new URLSearchParams({ ...(q ? { q } : {}), ...(id ? { category: String(id) } : {}) }).toString()}`;

  return (
    <div>
      {!q && !catId && (
        <section className="mb-6 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-500 p-8 text-white">
          <h1 className="text-3xl font-extrabold">Shop local. Pay on delivery.</h1>
          <p className="mt-2 text-brand-100">Handpicked products delivered to your doorstep in Kerala.</p>
        </section>
      )}
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
      <h2 className="mb-4 text-lg font-bold">{q ? `Results for “${q}”` : active ? active.name : "All products"}{q && active ? ` in ${active.name}` : ""} <span className="text-sm font-normal text-gray-500">({products.length})</span></h2>
      {products.length === 0 && <p className="text-gray-500">No products found.</p>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <Link key={p.id} href={`/product/${p.id}`} className="card group overflow-hidden transition hover:shadow-md">
            <CardSlideshow images={productImages(p)} alt={p.title} />
            <div className="p-3">
              <h3 className="line-clamp-2 min-h-10 text-sm font-medium">{p.title}</h3>
              <p className="mt-1 text-lg font-bold text-brand-700">{inr(p.price)}</p>
              <p className={`text-xs ${p.stock > 0 ? "text-gray-500" : "text-red-600"}`}>{p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</p>
              <span className="btn-primary mt-2 w-full">View Details</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
