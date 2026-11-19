"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "./Toaster";

/** "Share" on the product page: WhatsApp, copy link, or the phone's own share sheet (when the browser has one). */
export default function ShareButton({ title, price, publicId }: { title: string; price: string; publicId: string }) {
  const [open, setOpen] = useState(false);
  const [native, setNative] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setNative(typeof navigator !== "undefined" && typeof navigator.share === "function"); }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const url = () => `${location.origin}/product/${publicId}`;
  const text = () => `${title} — ${price}\nBuy it on enteCart.kerala:`;

  const whatsapp = () => { window.open(`https://wa.me/?text=${encodeURIComponent(`${text()}\n${url()}`)}`, "_blank", "noopener,noreferrer"); setOpen(false); };
  async function copy() {
    try { await navigator.clipboard.writeText(url()); toast.success("Link copied"); }
    catch { window.prompt("Copy this link:", url()); }
    setOpen(false);
  }
  async function more() { try { await navigator.share({ title, text: text(), url: url() }); } catch { /* cancelled */ } setOpen(false); }

  const item = "flex w-full items-center gap-2 rounded px-3 py-2.5 text-left text-sm hover:bg-brand-50";
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Share this product"
        className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-brand-300 hover:text-brand-700">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
        Share
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-52 rounded-xl border bg-white p-1 shadow-lg">
          <button role="menuitem" className={item} onClick={whatsapp}><span aria-hidden>💬</span> Share on WhatsApp</button>
          <button role="menuitem" className={item} onClick={copy}><span aria-hidden>🔗</span> Copy link</button>
          {native && <button role="menuitem" className={item} onClick={more}><span aria-hidden>📤</span> More…</button>}
        </div>
      )}
    </div>
  );
}
