"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "./Providers";
import { toast } from "./Toaster";
import type { Product } from "@/lib/types";

export default function BuyPanel({ product: p }: { product: Product }) {
  const sizes = p.sizes.split(",").map((s) => s.trim()).filter(Boolean);
  const [size, setSize] = useState(sizes[0] || "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { addToCart, buyNow, user, openAuth, cart } = useApp();
  const router = useRouter();
  // Live stock: the page itself may be a minute old, and other shoppers buy while you look. Re-check on open, every 15 s,
  // and whenever the tab comes back into view, so "Only N left" is always the real number.
  const [stock, setStock] = useState(p.stock);
  useEffect(() => { setStock(p.stock); }, [p.stock]);
  useEffect(() => {
    let alive = true;
    const load = () => fetch(`/api/stock?ids=${p.id}`).then((r) => r.json()).then((d) => {
      const n = d?.stock?.[String(p.id)];
      if (alive && typeof n === "number") setStock(n);
    }).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [p.id]);
  useEffect(() => { setQty((q) => Math.max(1, Math.min(q, stock || 1))); }, [stock]); // never offer more than what's left

  const out = stock <= 0;
  const inCart = cart.filter((x) => x.id === p.id).reduce((s, x) => s + x.qty, 0); // all sizes of this product
  const room = Math.max(0, stock - inCart);        // what can still be added to the cart
  const item = { id: p.id, title: p.title, price: p.price, image_url: p.image_url, size, qty, stock };

  return (
    <div className="mt-6 space-y-5">
      {sizes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Size</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button key={s} onClick={() => setSize(s)} className={`min-h-10 rounded-lg border px-4 py-1.5 text-sm ${size === s ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-gray-300"}`}>{s}</button>
            ))}
          </div>
        </div>
      )}
      <p className={`text-sm font-medium ${out ? "text-red-600" : stock < 10 ? "text-amber-600" : "text-brand-700"}`}>
        {out ? "Out of stock" : stock < 10 ? `Hurry! Only ${stock} left` : `In stock: ${stock} available`}
        {!out && inCart > 0 && <span className="ml-2 font-normal text-gray-500">· {inCart} in your cart{room === 0 ? " (that's all we have)" : ""}</span>}
      </p>
      {!out && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Qty</span>
          <button className="btn border !min-w-11 !px-0" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease quantity">−</button>
          <span className="w-6 text-center">{qty}</span>
          <button className="btn border !min-w-11 !px-0" onClick={() => setQty(Math.min(stock, qty + 1))} aria-label="Increase quantity">+</button>
        </div>
      )}
      <div className="h-16 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t border-gray-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <button className="btn-outline flex-1" disabled={out || room === 0} onClick={() => {
          const r = addToCart(item);
          if (r.added === 0) return toast.error(`You already have all ${r.stock} available in your cart`);
          toast.success(r.capped ? `Added ${r.added} — only ${r.stock} in stock` : `${p.title} added to cart`);
          setAdded(true); setTimeout(() => setAdded(false), 1500);
        }}>
          {out ? "Out of stock" : room === 0 ? "All in cart" : added ? "✓ Added" : "Add to Cart"}
        </button>
        <button className="btn-primary flex-1" disabled={out || qty > stock} onClick={() => {
          const go = () => { buyNow(item); router.push("/checkout?buynow=1"); };
          user ? go() : openAuth(go);
        }}>Buy Now</button>
      </div>
    </div>
  );
}
