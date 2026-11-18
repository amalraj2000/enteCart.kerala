"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { CartItem } from "@/lib/types";

type User = { id: number; identifier: string; first_name?: string; last_name?: string; avatar?: string } | null;
type Ctx = {
  user: User; authReady: boolean;
  openAuth: (cb?: () => void) => void; closeAuth: () => void; authOpen: boolean;
  setUser: (u: User) => void; refreshUser: () => Promise<void>; logout: () => Promise<void>;
  cart: CartItem[]; cartCount: number; cartTotal: number;
  addToCart: (i: CartItem) => void; setQty: (id: number, size: string, qty: number) => void;
  removeItem: (id: number, size: string) => void; clearCart: () => void;
  buyNow: (i: CartItem) => void; resetBuyNow: () => void; checkoutItems: CartItem[];
  afterAuth: () => void;
};
const C = createContext<Ctx>(null as any);
export const useApp = () => useContext(C);

export default function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [buyNowItem, setBuyNowItem] = useState<CartItem | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setUser(d.user)).finally(() => setAuthReady(true));
    if (new URLSearchParams(location.search).get("login") === "1") { // e.g. redirected from /admin when logged out
      setAuthOpen(true);
      history.replaceState(null, "", location.pathname);
    }
    try { setCart(JSON.parse(localStorage.getItem("ek_cart") || "[]")); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem("ek_cart", JSON.stringify(cart)); } catch {} }, [cart]);

  const key = (i: { id: number; size: string }) => `${i.id}|${i.size}`;
  const addToCart = useCallback((item: CartItem) => {
    setCart((c) => {
      const ex = c.find((x) => key(x) === key(item));
      if (ex) return c.map((x) => (key(x) === key(item) ? { ...x, qty: Math.min(x.qty + item.qty, item.stock) } : x));
      return [...c, item];
    });
  }, []);
  const setQty = (id: number, size: string, qty: number) =>
    setCart((c) => c.map((x) => (key(x) === key({ id, size }) ? { ...x, qty: Math.max(1, Math.min(qty, x.stock)) } : x)));
  const removeItem = (id: number, size: string) => setCart((c) => c.filter((x) => key(x) !== key({ id, size })));

  const ctx: Ctx = {
    user, authReady, authOpen, setUser,
    openAuth: (cb) => { setPending(() => cb || null); setAuthOpen(true); },
    closeAuth: () => { setAuthOpen(false); setPending(null); },
    afterAuth: () => { setAuthOpen(false); const p = pending; setPending(null); p?.(); },
    refreshUser: async () => { const d = await (await fetch("/api/auth/me")).json(); setUser(d.user); },
    logout: async () => { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); },
    cart, cartCount: cart.reduce((s, i) => s + i.qty, 0), cartTotal: cart.reduce((s, i) => s + i.qty * i.price, 0),
    addToCart, setQty, removeItem, clearCart: () => setCart([]),
    buyNow: (i) => setBuyNowItem(i), resetBuyNow: () => setBuyNowItem(null),
    checkoutItems: buyNowItem ? [buyNowItem] : cart,
  };
  return <C.Provider value={ctx}>{children}</C.Provider>;
}
