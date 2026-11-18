"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "./Providers";
import { toast } from "./Toaster";
import type { Product } from "@/lib/types";

export default function BuyPanel({ product: p }: { product: Product }) {
  const sizes = p.sizes.split(",").map((s) => s.trim()).filter(Boolean);
  const [size, setSize] = useState(sizes[0] || "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { addToCart, buyNow, user, openAuth } = useApp();
  const router = useRouter();
  const out = p.stock <= 0;
  const item = { id: p.id, title: p.title, price: p.price, image_url: p.image_url, size, qty, stock: p.stock };

  return (
    <div className="mt-6 space-y-5">
      {sizes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Size</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button key={s} onClick={() => setSize(s)} className={`rounded-lg border px-4 py-1.5 text-sm ${size === s ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-gray-300"}`}>{s}</button>
            ))}
          </div>
        </div>
      )}
      <p className={`text-sm font-medium ${out ? "text-red-600" : p.stock < 10 ? "text-amber-600" : "text-brand-700"}`}>
        {out ? "Out of stock" : p.stock < 10 ? `Hurry! Only ${p.stock} left` : `In stock: ${p.stock} available`}
      </p>
      {!out && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Qty</span>
          <button className="btn border" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
          <span className="w-6 text-center">{qty}</span>
          <button className="btn border" onClick={() => setQty(Math.min(p.stock, qty + 1))}>+</button>
        </div>
      )}
      <div className="flex gap-3">
        <button className="btn-outline flex-1" disabled={out} onClick={() => { addToCart(item); toast.success(`${p.title} added to cart`); setAdded(true); setTimeout(() => setAdded(false), 1500); }}>
          {added ? "✓ Added" : "Add to Cart"}
        </button>
        <button className="btn-primary flex-1" disabled={out} onClick={() => {
          const go = () => { buyNow(item); router.push("/checkout?buynow=1"); };
          user ? go() : openAuth(go);
        }}>Buy Now</button>
      </div>
      <p className="text-xs text-gray-500">💵 Cash on Delivery available</p>
    </div>
  );
}
