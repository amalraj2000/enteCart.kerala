import Link from "next/link";
import { discountPct, inr, productImages, type Product } from "@/lib/types";
import CardSlideshow from "./CardSlideshow";
import WishlistButton from "./WishlistButton";

export type CardProduct = Product & { is_new?: number | boolean; best?: boolean };

/** Up to two badges, most important first. */
function badges(p: CardProduct): { text: string; cls: string }[] {
  const b: { text: string; cls: string }[] = [];
  if (p.stock <= 0) b.push({ text: "Out of stock", cls: "bg-red-600 text-white" });
  else if (p.stock <= 5) b.push({ text: `Only ${p.stock} left`, cls: "bg-amber-500 text-white" });
  if (p.best) b.push({ text: "Best seller", cls: "bg-brand-700 text-white" });
  if (p.is_new) b.push({ text: "New", cls: "bg-blue-600 text-white" });
  return b.slice(0, 2);
}

export default function ProductCard({ p, priority = false }: { p: CardProduct; priority?: boolean }) {
  return (
    <div className="card group relative overflow-hidden transition hover:shadow-md">
      <Link href={`/product/${p.public_id || p.id}`} className="block">
        <div className="relative">
          <CardSlideshow images={productImages(p)} alt={p.title} priority={priority} />
          <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1">
            {badges(p).map((b) => <span key={b.text} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow ${b.cls}`}>{b.text}</span>)}
          </div>
        </div>
        <div className="p-2.5 sm:p-3">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-5">{p.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 sm:mt-1">
            <span className="text-base font-bold text-brand-700 sm:text-lg">{inr(p.price)}</span>
            {discountPct(p.price, p.original_price) > 0 && <>
              <span className="text-xs text-gray-400 line-through sm:text-sm">{inr(Number(p.original_price))}</span>
              <span className="text-xs font-semibold text-green-700">{discountPct(p.price, p.original_price)}% off</span>
            </>}
          </p>
          <span className="btn-primary mt-2 hidden w-full sm:inline-flex">View Details</span>
        </div>
      </Link>
      <WishlistButton productId={p.id} />
    </div>
  );
}
