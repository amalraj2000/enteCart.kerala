import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { inr, productImages, type Product } from "@/lib/types";
import Gallery from "@/components/Gallery";
import WishlistButton from "@/components/WishlistButton";
import BuyPanel from "@/components/BuyPanel";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db();
  const r = await c.execute({ sql: "SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?", args: [Number(id) || 0] });
  const p = r.rows[0] as unknown as Product | undefined;
  if (!p) notFound();
  return (
    <div className="card grid gap-8 p-4 md:grid-cols-2 md:p-8">
      <Gallery images={productImages(p)} alt={p.title} />
      <div>
        {p.category_name && <Link href={`/?category=${p.category_id}`} className="mb-2 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">{p.category_name}</Link>}
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{p.title}</h1>
          <WishlistButton productId={p.id} variant="inline" />
        </div>
        <p className="mt-2 text-3xl font-extrabold text-brand-700">{inr(p.price)}</p>
        <p className="mt-4 whitespace-pre-line text-gray-700">{p.description}</p>
        <BuyPanel product={p} />
      </div>
    </div>
  );
}
