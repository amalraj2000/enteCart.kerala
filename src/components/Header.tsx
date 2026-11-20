"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useApp } from "./Providers";
import { toast } from "./Toaster";
import AdminMenu from "./AdminMenu";
import NotificationBell from "./NotificationBell";

function SearchBox() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") || "");
  return (
    <form onSubmit={(e) => { e.preventDefault(); router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/"); }} className="flex flex-1">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for products…" maxLength={100} className="input rounded-r-none" />
      <button className="btn-primary rounded-l-none">Search</button>
    </form>
  );
}

export default function Header() {
  const { user, authReady, openAuth, logout, cartCount, wishlist } = useApp();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  if (usePathname().startsWith("/admin"))
    return (
      <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-xl font-extrabold tracking-tight text-brand-700">
            ente<span className="text-gray-900">Cart</span><span className="text-brand-500">.kerala</span>
          </span>
          <div className="flex items-center gap-2"><NotificationBell endpoint="/api/admin/notifications" emptyText="We’ll tell you here when a new order or review comes in." /><AdminMenu /></div>
        </div>
      </header>
    );
  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 md:py-3">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-brand-700">
          ente<span className="text-gray-900">Cart</span><span className="text-brand-500">.kerala</span>
        </Link>
        <div className="order-3 flex w-full md:order-none md:w-auto md:flex-1 md:px-6"><Suspense><SearchBox /></Suspense></div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link href="/wishlist" className="btn-outline relative !hidden !px-3 md:!inline-flex" aria-label={`Wishlist (${wishlist.length})`} title="Wishlist">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" strokeLinejoin="round" aria-hidden><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 2.8 5 6.2 5c2 0 3.2 1 3.8 2 .6-1 1.8-2 3.8-2 3.4 0 5.3 3.3 3.8 6.7C19.5 16.4 12 21 12 21z" /></svg>
            {wishlist.length > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">{wishlist.length}</span>}
          </Link>
          <Link href="/cart" className="btn-outline relative !hidden md:!inline-flex" aria-label="Cart">
            🛒 Cart
            {cartCount > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">{cartCount}</span>}
          </Link>
          {!authReady ? null : user ? (<>
            <NotificationBell userId={user.id} />
            <div className="relative">
              <button className="flex items-center gap-2 rounded-full bg-brand-600 py-1 pl-1 pr-2 text-sm font-semibold text-white hover:bg-brand-700 md:pr-4" onClick={() => setMenu(!menu)} aria-label="Account menu">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25">{(user.name || user.identifier)[0].toUpperCase()}</span>
                )}
                <span className="hidden md:inline">{(user.name?.split(" ")[0] || user.identifier.split("@")[0]).slice(0, 12)}</span>
              </button>
              {menu && (
                <div className="card absolute right-0 z-50 mt-2 w-48 p-1 text-base md:text-sm" onClick={() => setMenu(false)}>
                  <Link href="/account" className="block rounded px-3 py-3 md:py-2 hover:bg-brand-50">Profile settings</Link>
                  <Link href="/orders" className="block rounded px-3 py-3 md:py-2 hover:bg-brand-50">My Orders</Link>
                  <Link href="/wishlist" className="block rounded px-3 py-3 md:py-2 hover:bg-brand-50">My Wishlist</Link>
                  <button className="block w-full rounded px-3 py-3 text-left hover:bg-brand-50 md:py-2" onClick={async () => { await logout(); toast.success("Logged out"); router.push("/"); }}>Logout</button>
                </div>
              )}
            </div>
          </>) : (
            <button className="btn-primary !min-h-10 !px-4" onClick={() => openAuth()}>Login<span className="hidden md:inline">&nbsp;/ Register</span></button>
          )}
        </div>
      </div>
    </header>
  );
}
