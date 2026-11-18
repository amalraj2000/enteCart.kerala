"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/Providers";
import ProductCard, { type CardProduct } from "@/components/ProductCard";

export default function WishlistPage() {
  const { user, authReady, openAuth, wishlist } = useApp();
  const [products, setProducts] = useState<CardProduct[] | null>(null);
  useEffect(() => {
    if (user) fetch("/api/wishlist?full=1").then((r) => r.json()).then((d) => setProducts(d.products || []));
  }, [user]);

  if (!authReady) return null;
  if (!user) return <div className="card p-8 text-center"><p className="mb-3">Log in to see your wishlist.</p><button className="btn-primary" onClick={() => openAuth()}>Login / Sign up</button></div>;
  if (!products) return <p>Loading…</p>;
  const shown = products.filter((p) => wishlist.includes(Number(p.id))); // removing a heart removes the card instantly
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">My Wishlist <span className="text-sm font-normal text-gray-500">({shown.length})</span></h1>
      {shown.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-4xl">🤍</p>
          <p className="mt-2 text-gray-600">Nothing saved yet. Tap the heart on any product to save it here.</p>
          <Link href="/" className="btn-primary mt-4">Browse products</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{shown.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      )}
    </div>
  );
}
