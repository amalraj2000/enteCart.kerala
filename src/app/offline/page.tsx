import type { Metadata } from "next";
import RetryButton from "./RetryButton";
export const metadata: Metadata = { title: "You're offline — enteCart.kerala" };

/** Shown by the service worker when there is no internet connection. */
export default function Offline() {
  return (
    <div className="card mx-auto max-w-md p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl" aria-hidden>📡</div>
      <h1 className="mt-4 text-2xl font-bold text-brand-700">You’re offline</h1>
      <p className="mt-2 text-gray-600">We can’t reach the shop right now. Check your internet connection and try again — your cart is saved on this device.</p>
      <RetryButton />
    </div>
  );
}
