"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/Providers";
import Img from "@/components/Img";
import { toast } from "@/components/Toaster";
import { inr } from "@/lib/types";
import { stockProblems } from "@/lib/stockCheck";

export default function CartPage() {
  const { cart, cartTotal, setQty, removeItem, user, openAuth, resetBuyNow, syncStock } = useApp();
  const router = useRouter();
  useEffect(() => { resetBuyNow(); syncStock(); }, []); // eslint-disable-line react-hooks/exhaustive-deps  — live stock on every visit

  if (!cart.length)
    return (
      <div className="card p-10 text-center">
        <p className="text-4xl">🛒</p>
        <p className="mt-2 text-gray-600">Your cart is empty.</p>
        <Link href="/" className="btn-primary mt-4">Continue shopping</Link>
      </div>
    );
  const problems = stockProblems(cart);
  const go = () => router.push("/checkout");
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="space-y-3 md:col-span-2">
        <h1 className="text-xl font-bold">Your Cart</h1>
        {cart.map((i) => (
          <div key={`${i.id}|${i.size}`} className="card flex gap-4 p-3">
            <Img src={i.image_url} alt={i.title} sizes="96px" className="h-24 w-24 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <Link href={`/product/${i.id}`} className="font-medium hover:underline">{i.title}</Link>
              {i.size && <p className="text-xs text-gray-500">Size: {i.size}</p>}
              {i.stock <= 0 && <p className="text-xs font-semibold text-red-600">Out of stock — remove it to continue</p>}
              {i.stock > 0 && i.stock < 10 && <p className="text-xs font-medium text-amber-600">Only {i.stock} left</p>}
              <p className="font-bold text-brand-700">{inr(i.price)}</p>
              <div className="mt-2 flex items-center gap-2">
                <button className="btn border !min-w-10 !px-0 !py-0" onClick={() => setQty(i.id, i.size, i.qty - 1)} aria-label="Decrease quantity">−</button>
                <span className="w-6 text-center text-sm">{i.qty}</span>
                <button className="btn border !min-w-10 !px-0 !py-0" disabled={i.stock <= 0 || cart.filter((x) => x.id === i.id).reduce((s, x) => s + x.qty, 0) >= i.stock} onClick={() => setQty(i.id, i.size, i.qty + 1)} aria-label="Increase quantity">+</button>
                <button className="ml-2 py-2 text-sm text-red-600 hover:underline" onClick={() => { removeItem(i.id, i.size); toast.success("Item removed from cart"); }}>Remove</button>
              </div>
            </div>
            <p className="font-semibold">{inr(i.price * i.qty)}</p>
          </div>
        ))}
      </div>
      <div className="h-20 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-4 border-t border-gray-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:card md:static md:z-auto md:block md:h-fit md:space-y-3 md:border md:p-5 md:backdrop-blur-none">
        <h2 className="hidden font-bold md:block">Order Summary</h2>
        <div className="md:flex md:justify-between"><span className="block text-xs text-gray-500 md:inline md:text-base md:text-gray-900">Total</span><span className="text-xl font-extrabold text-brand-700">{inr(cartTotal)}</span></div>
        <p className="hidden text-xs text-gray-500 md:block">Pay online (UPI, cards, netbanking) or Cash on Delivery</p>
        {problems.length > 0 && <p className="hidden text-xs font-medium text-red-600 md:block">{problems[0]}</p>}
        <button className="btn-primary flex-1 md:w-full md:flex-none" disabled={problems.length > 0} title={problems[0]} onClick={() => (user ? go() : openAuth(go))}>{problems.length ? "Fix cart to continue" : "Proceed to Checkout"}</button>
      </div>
    </div>
  );
}
