"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/Providers";
import Img from "@/components/Img";
import { toast } from "@/components/Toaster";
import { inr } from "@/lib/types";

export default function CartPage() {
  const { cart, cartTotal, setQty, removeItem, user, openAuth, resetBuyNow } = useApp();
  const router = useRouter();
  useEffect(() => resetBuyNow(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cart.length)
    return (
      <div className="card p-10 text-center">
        <p className="text-4xl">🛒</p>
        <p className="mt-2 text-gray-600">Your cart is empty.</p>
        <Link href="/" className="btn-primary mt-4">Continue shopping</Link>
      </div>
    );
  const go = () => router.push("/checkout");
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="space-y-3 md:col-span-2">
        <h1 className="text-xl font-bold">Your Cart</h1>
        {cart.map((i) => (
          <div key={`${i.id}|${i.size}`} className="card flex gap-4 p-3">
            <Img src={i.image_url} alt={i.title} className="h-24 w-24 rounded-lg object-cover" />
            <div className="flex-1">
              <Link href={`/product/${i.id}`} className="font-medium hover:underline">{i.title}</Link>
              {i.size && <p className="text-xs text-gray-500">Size: {i.size}</p>}
              <p className="font-bold text-brand-700">{inr(i.price)}</p>
              <div className="mt-2 flex items-center gap-2">
                <button className="btn border !px-2 !py-0.5" onClick={() => setQty(i.id, i.size, i.qty - 1)}>−</button>
                <span className="w-6 text-center text-sm">{i.qty}</span>
                <button className="btn border !px-2 !py-0.5" onClick={() => setQty(i.id, i.size, i.qty + 1)}>+</button>
                <button className="ml-3 text-sm text-red-600 hover:underline" onClick={() => { removeItem(i.id, i.size); toast.success("Item removed from cart"); }}>Remove</button>
              </div>
            </div>
            <p className="font-semibold">{inr(i.price * i.qty)}</p>
          </div>
        ))}
      </div>
      <div className="card h-fit space-y-3 p-5">
        <h2 className="font-bold">Order Summary</h2>
        <div className="flex justify-between"><span>Total</span><span className="text-xl font-extrabold text-brand-700">{inr(cartTotal)}</span></div>
        <p className="text-xs text-gray-500">Payment: Cash on Delivery</p>
        <button className="btn-primary w-full" onClick={() => (user ? go() : openAuth(go))}>Proceed to Checkout</button>
      </div>
    </div>
  );
}
