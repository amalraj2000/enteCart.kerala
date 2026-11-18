"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useApp } from "./Providers";
import { toast } from "./Toaster";
import AdminMenu from "./AdminMenu";

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
  const { user, authReady, openAuth, logout, cartCount } = useApp();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  if (usePathname().startsWith("/admin"))
    return (
      <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-xl font-extrabold tracking-tight text-brand-700">
            ente<span className="text-gray-900">Cart</span><span className="text-brand-500">.kerala</span>
          </span>
          <AdminMenu />
        </div>
      </header>
    );
  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-brand-700">
          ente<span className="text-gray-900">Cart</span><span className="text-brand-500">.kerala</span>
        </Link>
        <div className="order-3 flex w-full md:order-none md:w-auto md:flex-1 md:px-6"><Suspense><SearchBox /></Suspense></div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link href="/cart" className="btn-outline relative" aria-label="Cart">
            🛒 Cart
            {cartCount > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">{cartCount}</span>}
          </Link>
          {!authReady ? null : user ? (
            <div className="relative">
              <button className="flex items-center gap-2 rounded-full bg-brand-600 py-1 pl-1 pr-4 text-sm font-semibold text-white hover:bg-brand-700" onClick={() => setMenu(!menu)}>
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25">{(user.first_name || user.identifier)[0].toUpperCase()}</span>
                )}
                {(user.first_name || user.identifier.split("@")[0]).slice(0, 12)}
              </button>
              {menu && (
                <div className="card absolute right-0 mt-2 w-44 p-1 text-sm" onClick={() => setMenu(false)}>
                  <Link href="/account" className="block rounded px-3 py-2 hover:bg-brand-50">Profile settings</Link>
                  <Link href="/orders" className="block rounded px-3 py-2 hover:bg-brand-50">My Orders</Link>
                  <button className="block w-full rounded px-3 py-2 text-left hover:bg-brand-50" onClick={async () => { await logout(); toast.success("Logged out"); router.push("/"); }}>Logout</button>
                </div>
              )}
            </div>
          ) : (
            <button className="btn-primary" onClick={() => openAuth()}>Login / Sign up</button>
          )}
        </div>
      </div>
    </header>
  );
}
