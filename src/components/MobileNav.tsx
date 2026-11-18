"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./Providers";

const ICONS = {
  home: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5z",
  heart: "M12 21s-7.5-4.6-9.6-9.3C.9 8.3 2.8 5 6.2 5c2 0 3.2 1 3.8 2 .6-1 1.8-2 3.8-2 3.4 0 5.3 3.3 3.8 6.7C19.5 16.4 12 21 12 21z",
  bag: "M6 7h12l1 13H5L6 7zm3 0a3 3 0 0 1 6 0",
  orders: "M7 3h10a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zm2 5h6M9 12h6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0",
};

/** Thumb-reach navigation for phones. Hidden on desktop, in admin, and on pages that have their own bottom action bar. */
export default function MobileNav() {
  const path = usePathname();
  const { cartCount, wishlist, user, openAuth } = useApp();
  if (path.startsWith("/admin") || path.startsWith("/product/") || path === "/cart" || path === "/checkout") return null;

  const items: { label: string; href?: string; icon: keyof typeof ICONS; badge?: number; onClick?: () => void; on: boolean }[] = [
    { label: "Home", href: "/", icon: "home", on: path === "/" },
    { label: "Wishlist", href: "/wishlist", icon: "heart", badge: wishlist.length, on: path.startsWith("/wishlist") },
    { label: "Cart", href: "/cart", icon: "bag", badge: cartCount, on: false },
    { label: "Orders", href: "/orders", icon: "orders", on: path.startsWith("/orders") },
    user ? { label: "Account", href: "/account", icon: "user", on: path.startsWith("/account") } : { label: "Login", icon: "user", onClick: () => openAuth(), on: false },
  ];
  const cls = (on: boolean) => `relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${on ? "text-brand-700" : "text-gray-500"}`;
  const inner = (it: (typeof items)[number]) => (
    <>
      <span className="relative">
        <svg viewBox="0 0 24 24" className={`h-6 w-6 ${it.on ? "stroke-brand-700" : "stroke-current"} ${it.icon === "heart" && it.on ? "fill-brand-100" : "fill-none"}`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONS[it.icon]} /></svg>
        {!!it.badge && <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{it.badge > 99 ? "99+" : it.badge}</span>}
      </span>
      {it.label}
    </>
  );
  return (
    <>
      <div className="h-16 md:hidden" aria-hidden /> {/* keeps the last content clear of the bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-md">
          {items.map((it) => (
            <li key={it.label} className="flex flex-1">
              {it.href
                ? <Link href={it.href} className={cls(it.on)} aria-current={it.on ? "page" : undefined}>{inner(it)}</Link>
                : <button type="button" onClick={it.onClick} className={cls(it.on)}>{inner(it)}</button>}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
