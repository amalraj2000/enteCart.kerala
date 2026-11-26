"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ORDER_STATUSES } from "@/lib/types";

const PRESETS = ["All dates", "Today", "Yesterday", "This month", "Last month", "Custom range"] as const;
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${ym}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`; };
const prevMonth = (ym: string) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; };

/** "Export CSV" button → popup with filters (type, status, payment, dates, search) and a live count of the orders that will be in the file. */
export default function ExportDialog({ today, yesterday, thisMonth, hasInbox }: { today: string; yesterday: string; thisMonth: string; hasInbox: boolean }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ type: "all", status: "All", pay: "", preset: "All dates" as (typeof PRESETS)[number], from: "", to: "", q: "" });
  const [count, setCount] = useState<number | null>(null);
  const [max, setMax] = useState(20000);
  const [err, setErr] = useState(false);

  // Dates the chosen preset stands for (IST, same as the Orders page)
  const range = (): { from: string; to: string } => {
    switch (f.preset) {
      case "Today": return { from: today, to: today };
      case "Yesterday": return { from: yesterday, to: yesterday };
      case "This month": return { from: `${thisMonth}-01`, to: lastDay(thisMonth) };
      case "Last month": { const m = prevMonth(thisMonth); return { from: `${m}-01`, to: lastDay(m) }; }
      case "Custom range": return { from: f.from, to: f.to };
      default: return { from: "", to: "" };
    }
  };
  const query = () => {
    const r = range(), p = new URLSearchParams();
    if (f.type !== "all") p.set("type", f.type);
    if (f.status !== "All") p.set("status", f.status);
    if (f.pay) p.set("pay", f.pay);
    if (r.from) p.set("from", r.from);
    if (r.to) p.set("to", r.to);
    if (f.q.trim()) p.set("q", f.q.trim());
    if (!r.from && !r.to) p.set("date", "all"); // no dates chosen = ALL dates (not just today)
    return p;
  };

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [open]);

  // live count of matching orders (short delay while typing)
  useEffect(() => {
    if (!open) return;
    setCount(null); setErr(false);
    const p = query(); p.set("count", "1");
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/orders/export?${p}`, { signal: ctl.signal });
        if (!r.ok) throw new Error();
        const d = await r.json(); setCount(d.count); setMax(d.max);
      } catch (e) { if ((e as Error).name !== "AbortError") setErr(true); }
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, f]);

  function download() {
    const a = document.createElement("a");
    a.href = `/api/admin/orders/export?${query()}`; a.download = ""; document.body.appendChild(a); a.click(); a.remove();
    setOpen(false);
  }
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const bad = f.preset === "Custom range" && !f.from && !f.to;

  return (
    <>
      <button type="button" className="btn-outline shrink-0" onClick={() => setOpen(true)}>⬇ Export CSV</button>
      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Export orders" className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
              <h2 className="text-lg font-bold">Export orders to CSV</h2>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-gray-500 hover:bg-gray-100">✕</button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <p className="text-sm text-gray-500">Choose what to include. Leave everything on “All” to export every order.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {hasInbox && (
                  <label className="block text-sm font-medium">Order type
                    <select className="input mt-1" value={f.type} onChange={(e) => set({ type: e.target.value })}><option value="all">All orders (website + inbox)</option><option value="website">Website orders only</option><option value="inbox">Inbox orders only</option></select></label>
                )}
                <label className="block text-sm font-medium">Order status
                  <select className="input mt-1" value={f.status} onChange={(e) => set({ status: e.target.value })}><option>All</option>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
                <label className="block text-sm font-medium">Payment status
                  <select className="input mt-1" value={f.pay} onChange={(e) => set({ pay: e.target.value })}><option value="">All</option><option>Paid</option><option>Pending</option><option>Unpaid</option><option>Refunded</option></select></label>
                <label className="block text-sm font-medium">Date
                  <select className="input mt-1" value={f.preset} onChange={(e) => set({ preset: e.target.value as (typeof PRESETS)[number] })}>{PRESETS.map((p) => <option key={p}>{p}</option>)}</select></label>
                {f.preset === "Custom range" && (
                  <>
                    <label className="block text-sm font-medium">From<input type="date" className="input mt-1" max={f.to || today} value={f.from} onChange={(e) => set({ from: e.target.value })} /></label>
                    <label className="block text-sm font-medium">To<input type="date" className="input mt-1" min={f.from} max={today} value={f.to} onChange={(e) => set({ to: e.target.value })} /></label>
                  </>
                )}
                <label className="block text-sm font-medium sm:col-span-2">Search (optional)
                  <input className="input mt-1" maxLength={60} placeholder="Order no, customer name, phone or email" value={f.q} onChange={(e) => set({ q: e.target.value })} /></label>
              </div>
              {hasInbox && f.type !== "website" && <p className="text-xs text-gray-400">For inbox orders: Pending counts as Placed, and Processing counts as Confirmed.</p>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-gray-50 px-5 py-3">
              <p className="text-sm text-gray-600" aria-live="polite">
                {bad ? <span className="text-amber-700">Pick a From or To date</span> : err ? <span className="text-red-600">Could not count orders</span> : count === null ? "Counting…" : <><b>{count}</b> order{count === 1 ? "" : "s"} will be exported{count > max ? <span className="text-amber-700"> (first {max.toLocaleString("en-IN")} only)</span> : null}</>}
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
                <button type="button" className="btn-primary" disabled={count === 0 || count === null || bad} onClick={download}>⬇ Download CSV</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
