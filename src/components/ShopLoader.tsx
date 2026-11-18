"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Shopping-cart loader for the customer side. Shows itself when a click is taking a while:
 *  • clicking a link to another page (until the new page has rendered), and
 *  • any save/submit request to our API (add to cart, place order, login, cancel…) that is still running after a moment.
 * Quick actions never flash it (short delays), the admin panel is left alone, and it removes itself after 15 s at most.
 */
function Inner() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [nav, setNav] = useState(false);
  const [calls, setCalls] = useState(0);
  const navTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const admin = pathname.startsWith("/admin");

  // The new page has arrived → hide.
  useEffect(() => { clearTimeout(navTimer.current); setNav(false); }, [pathname, search]);

  // Link clicks
  useEffect(() => {
    if (admin) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || u.pathname.startsWith("/admin") || u.pathname.startsWith("/api")) return;
      if (u.pathname === location.pathname && u.search === location.search) return; // same page / #hash
      clearTimeout(navTimer.current);
      navTimer.current = setTimeout(() => { setNav(true); setTimeout(() => setNav(false), 15000); }, 150); // fast pages never flash it
    };
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); clearTimeout(navTimer.current); };
  }, [admin]);

  // Save / submit requests (anything that isn't a plain read) to our own API
  useEffect(() => {
    if (admin) return;
    const orig = window.fetch;
    window.fetch = async (input, init) => {
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const path = new URL(url, location.href).pathname;
      if (method === "GET" || !path.startsWith("/api/") || path.startsWith("/api/admin")) return orig(input, init);
      let shown = false, done = false;
      const t = setTimeout(() => { if (!done) { shown = true; setCalls((n) => n + 1); } }, 400);
      try { return await orig(input, init); }
      finally { done = true; clearTimeout(t); if (shown) setCalls((n) => Math.max(0, n - 1)); }
    };
    return () => { window.fetch = orig; };
  }, [admin]);

  if (admin || (!nav && calls === 0)) return null;
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="fixed inset-0 z-[90] flex cursor-progress items-center justify-center bg-white/70 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-xl ring-1 ring-black/5">
        <div className="relative h-14 w-20">
          <span className="absolute left-5 top-0 text-lg animate-[item-drop_1.2s_ease-in_infinite]">🛍️</span>
          <span className="absolute left-9 top-0 text-lg animate-[item-drop_1.2s_ease-in_.4s_infinite]">📦</span>
          <span className="absolute left-12 top-0 text-lg animate-[item-drop_1.2s_ease-in_.8s_infinite]">🥥</span>
          <span className="absolute bottom-0 left-4 text-4xl animate-[cart-bob_.6s_ease-in-out_infinite_alternate]">🛒</span>
        </div>
        <p className="text-sm font-semibold text-brand-700">Just a moment…</p>
      </div>
    </div>
  );
}

export default function ShopLoader() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
