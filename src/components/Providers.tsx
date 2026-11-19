"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { CartItem } from "@/lib/types";
import { toast } from "./Toaster";

type User = { id: number; identifier: string; name?: string; email?: string | null; phone?: string | null; avatar?: string } | null;
type Ctx = {
  user: User; authReady: boolean;
  openAuth: (cb?: () => void) => void; closeAuth: () => void; authOpen: boolean;
  setUser: (u: User) => void; refreshUser: () => Promise<void>; logout: () => Promise<void>;
  cart: CartItem[]; cartCount: number; cartTotal: number;
  addToCart: (i: CartItem) => { added: number; stock: number; capped: boolean; inCart: number }; syncStock: () => Promise<boolean>; setQty: (id: number, size: string, qty: number) => void;
  removeItem: (id: number, size: string) => void; clearCart: () => void;
  buyNow: (i: CartItem) => void; resetBuyNow: () => void; checkoutItems: CartItem[];
  afterAuth: () => void;
  wishlist: number[]; toggleWish: (productId: number) => void;
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
  const buyNowRef = useRef<CartItem | null>(null);
  buyNowRef.current = buyNowItem;
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [cartReady, setCartReady] = useState(false);

  // Wishlist lives in the database for logged-in customers.
  useEffect(() => {
    if (!user) return setWishlist([]);
    fetch("/api/wishlist").then((r) => r.json()).then((d) => setWishlist(d.ids || []));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const openAuthRef = { current: (cb?: () => void) => { setPending(() => cb || null); setAuthOpen(true); } };
  const applyWish = (productId: number, on: boolean) => {
    setWishlist((w) => (on ? (w.includes(productId) ? w : [...w, productId]) : w.filter((x) => x !== productId))); // optimistic
    fetch("/api/wishlist", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, on }) }).then(async (r) => {
      if (r.ok) return toast.success(on ? "Added to wishlist" : "Removed from wishlist");
      setWishlist((w) => (on ? w.filter((x) => x !== productId) : [...w, productId]));
      toast.error((await r.json().catch(() => ({}))).error || "Could not update wishlist");
    });
  };
  // Logged out: open the login box, then add the product as soon as login succeeds.
  const toggleWish = (productId: number) => {
    if (!user) return openAuthRef.current(() => applyWish(productId, true));
    applyWish(productId, !wishlist.includes(productId));
  };

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setUser(d.user)).finally(() => setAuthReady(true));
    if (new URLSearchParams(location.search).get("login") === "1") { // e.g. redirected from /admin when logged out
      setAuthOpen(true);
      history.replaceState(null, "", location.pathname);
    }
    try { setCart(JSON.parse(localStorage.getItem("ek_cart") || "[]")); } catch {}
    setCartReady(true);
  }, []);
  // Once the saved cart has been loaded, refresh it with live stock (covers direct visits and page refreshes).
  useEffect(() => { if (cartReady) syncStock(); }, [cartReady]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem("ek_cart", JSON.stringify(cart)); } catch {} }, [cart]);

  const key = (i: { id: number; size: string }) => `${i.id}|${i.size}`;
  const cartRef = useRef<CartItem[]>([]);
  cartRef.current = cart;
  const inCartQty = (items: CartItem[], id: number, exceptKey?: string) => items.filter((x) => x.id === id && key(x) !== exceptKey).reduce((s, x) => s + x.qty, 0);

  /** Adds up to what is left in stock. The total of one product across ALL its sizes can never exceed its stock. */
  const addToCart = useCallback((item: CartItem) => {
    const have = inCartQty(cartRef.current, item.id);
    const room = Math.max(0, item.stock - have);
    const add = Math.min(item.qty, room);
    if (add > 0)
      setCart((c) => {
        const ex = c.find((x) => key(x) === key(item));
        return ex ? c.map((x) => (key(x) === key(item) ? { ...x, qty: x.qty + add, stock: item.stock } : x)) : [...c, { ...item, qty: add }];
      });
    return { added: add, stock: item.stock, capped: add < item.qty, inCart: have };
  }, []);

  const setQty = (id: number, size: string, qty: number) => {
    const line = cartRef.current.find((x) => key(x) === key({ id, size }));
    if (!line) return;
    const max = Math.max(1, line.stock - inCartQty(cartRef.current, id, key(line))); // what's left after the same product's other sizes
    if (qty > max) toast.error(line.stock <= 0 ? "This item is out of stock" : `Only ${line.stock} available${line.stock !== max ? " (including your other sizes of this item)" : ""}`);
    setCart((c) => c.map((x) => (key(x) === key({ id, size }) ? { ...x, qty: Math.max(1, Math.min(qty, max)) } : x)));
  };
  const removeItem = (id: number, size: string) => setCart((c) => c.filter((x) => key(x) !== key({ id, size })));

  /** Refreshes every cart / buy-now line with the LIVE stock and trims quantities that no longer fit. */
  const syncStock = useCallback(async () => {
    const all = [...cartRef.current, ...(buyNowRef.current ? [buyNowRef.current] : [])];
    const ids = [...new Set(all.map((i) => i.id))];
    if (!ids.length) return true;
    const r = await fetch(`/api/stock?ids=${ids.join(",")}`, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return false; // couldn't verify — callers must not let the order through on stale numbers
    const body = await r.json();
    const live: Record<string, number> = body.stock;
    const gone = new Set<number>(body.gone || []);
    const notes: string[] = [];
    const fix = (items: CartItem[]): CartItem[] => {
      const used = new Map<number, number>();
      return items.map((x) => {
        const stock = live[String(x.id)] ?? x.stock;
        const left = Math.max(0, stock - (used.get(x.id) || 0));
        const qty = stock <= 0 ? x.qty : Math.max(1, Math.min(x.qty, left));
        if (stock > 0 && qty < x.qty) notes.push(`“${x.title}” reduced to ${qty} — only ${stock} in stock`);
        used.set(x.id, (used.get(x.id) || 0) + (stock <= 0 ? 0 : qty));
        return { ...x, stock: gone.has(x.id) ? 0 : stock, qty, gone: gone.has(x.id) };
      });
    };
    // Computed synchronously (not inside a state updater) so the notes below are ready when we toast them.
    const fixedCart = fix(cartRef.current);
    const fixedBuyNow = buyNowRef.current ? fix([buyNowRef.current])[0] : null;
    setCart(fixedCart);
    setBuyNowItem(fixedBuyNow);
    [...new Set(notes)].forEach((n) => toast.error(n));
    return true;
  }, []);

  const ctx: Ctx = {
    user, authReady, authOpen, setUser,
    openAuth: (cb) => { setPending(() => cb || null); setAuthOpen(true); },
    closeAuth: () => { setAuthOpen(false); setPending(null); },
    afterAuth: () => { setAuthOpen(false); const p = pending; setPending(null); p?.(); },
    refreshUser: async () => { const d = await (await fetch("/api/auth/me")).json(); setUser(d.user); },
    logout: async () => { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); },
    wishlist, toggleWish,
    cart, cartCount: cart.reduce((s, i) => s + i.qty, 0), cartTotal: cart.reduce((s, i) => s + i.qty * i.price, 0),
    addToCart, syncStock, setQty, removeItem, clearCart: () => setCart([]),
    buyNow: (i) => setBuyNowItem(i), resetBuyNow: () => setBuyNowItem(null),
    checkoutItems: buyNowItem ? [buyNowItem] : cart,
  };
  return <C.Provider value={ctx}>{children}</C.Provider>;
}
