"use client";
import IconBtn from "@/components/IconBtn";
import StatusSelect from "../orders/StatusSelect";
import Img from "@/components/Img";
import Pagination from "@/components/Pagination";
import FieldError from "@/components/FieldError";
import Req from "@/components/Req";
import { toast } from "@/components/Toaster";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatIst, istDay } from "@/lib/istDate";
import { inr } from "@/lib/types";
import type { PageInfo } from "@/lib/paginate";
import { PAY_METHODS, PAY_STATUSES, SOURCES, STATUSES } from "@/lib/inboxConsts";

export type InboxItem = { product_id: number | null; title: string; qty: number; price: number; image_url: string };
export type InboxOrder = {
  id: number; order_no: string; customer_name: string; phone: string; house_name: string; street_name: string; city: string; state: string; pincode: string; instructions: string;
  source: string; order_date: string; payment_method: string; payment_status: string; status: string; tracking_number: string; notes: string;
  subtotal: number; delivery_charge: number; discount: number; total: number; created_at: string; updated_at: string;
  items: InboxItem[]; history: { event: string; actor: string; created_at: string }[];
};
export type PickProduct = { id: number; title: string; price: number; image_url: string; stock: number };
type Filters = { q: string; status: string; source: string; pay: string; from: string; to: string; sort: string };
type Summary = { total: number; delivered: number };
type Modal = { kind: "form"; id?: number } | { kind: "view"; id: number } | { kind: "delete"; id: number } | null;

const BADGE: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800", Confirmed: "bg-sky-100 text-sky-800", Processing: "bg-indigo-100 text-indigo-800",
  Shipped: "bg-purple-100 text-purple-800", Delivered: "bg-green-100 text-green-800", Cancelled: "bg-red-100 text-red-700",
  Paid: "bg-green-100 text-green-800", Refunded: "bg-gray-200 text-gray-700",
};
const Badge = ({ v }: { v: string }) => <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[v] ?? "bg-gray-100 text-gray-700"}`}>{v}</span>;
const dmy = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : d);
const SRC_ICON: Record<string, string> = { Instagram: "📸", Facebook: "📘", WhatsApp: "💬", Other: "✉️" };

export default function InboxManager({ orders, pi, summary, products, filters }: { orders: InboxOrder[]; pi: PageInfo; summary: Summary; products: PickProduct[]; filters: Filters }) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [f, setF] = useState(filters);
  const cur = modal && "id" in modal && modal.id ? orders.find((o) => o.id === modal.id) : undefined;

  const qs = (over: Partial<Filters & { page: number }>) => {
    const m = { ...f, ...over } as Record<string, string | number>;
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(m)) if (v && !(k === "sort" && v === "newest") && !(k === "page" && v === 1)) p.set(k, String(v));
    const s = p.toString();
    return "/admin/inbox-orders" + (s ? `?${s}` : "");
  };
  const apply = (over: Partial<Filters> = {}) => router.push(qs({ ...over, page: 1 }));
  const hasFilter = !!(filters.q || filters.status || filters.source || filters.pay || filters.from || filters.to);

  async function patch(o: InboxOrder, body: Record<string, string>, msg: string) {
    setBusy(o.id);
    const r = await fetch(`/api/admin/inbox-orders/${o.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || "Could not update the order");
    toast.success(msg); router.refresh();
  }
  async function remove(o: InboxOrder) {
    setBusy(o.id);
    const r = await fetch(`/api/admin/inbox-orders/${o.id}`, { method: "DELETE" });
    setBusy(null);
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || "Could not delete the order");
    setModal(null); toast.success(`${o.order_no} deleted`); router.refresh();
  }

  const cards: [string, string | number, string][] = [
    ["Total inbox orders", summary.total, "All saved orders"], ["Delivered", summary.delivered, "Completed orders"],
  ];


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold">Inbox Orders</h1><p className="text-sm text-gray-500">Orders received on Instagram, Facebook, WhatsApp or other messages.</p></div>
        <div className="flex flex-wrap gap-2"><a className="btn-outline" download href={`/api/admin/inbox-orders/export?${new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)))}`}>⬇ Export CSV</a><button className="btn-primary" onClick={() => setModal({ kind: "form" })}>+ Add Inbox Order</button></div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        {cards.map(([l, v, sub]) => (
          <div key={l} className="card p-4"><p className="text-xs text-gray-500">{l}</p><p className="mt-1 text-2xl font-extrabold tracking-tight">{v}</p><p className="mt-0.5 text-[11px] leading-tight text-gray-400">{sub}</p></div>
        ))}
      </div>

      <form className="card grid grid-cols-2 gap-2 p-3 md:grid-cols-3 xl:grid-cols-4" onSubmit={(e) => { e.preventDefault(); apply(); }}>
        <input className="input col-span-2 md:col-span-3 xl:col-span-2" placeholder="Search name, phone or order ID" aria-label="Search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select className="input" aria-label="Status" value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); apply({ status: e.target.value }); }}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="input" aria-label="Source" value={f.source} onChange={(e) => { setF({ ...f, source: e.target.value }); apply({ source: e.target.value }); }}><option value="">All sources</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="input" aria-label="Payment status" value={f.pay} onChange={(e) => { setF({ ...f, pay: e.target.value }); apply({ pay: e.target.value }); }}><option value="">All payments</option>{PAY_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <input type="date" className="input" aria-label="From date" value={f.from} onChange={(e) => { setF({ ...f, from: e.target.value }); apply({ from: e.target.value }); }} />
        <input type="date" className="input" aria-label="To date" value={f.to} onChange={(e) => { setF({ ...f, to: e.target.value }); apply({ to: e.target.value }); }} />
        <select className="input" aria-label="Sort" value={f.sort} onChange={(e) => { setF({ ...f, sort: e.target.value }); apply({ sort: e.target.value }); }}>
          <option value="newest">Newest added</option><option value="oldest">Oldest added</option><option value="date">Order date</option><option value="high">Amount: high → low</option><option value="low">Amount: low → high</option>
        </select>
        <div className="col-span-full flex gap-2">
          <button className="btn-primary">Search</button>
          {hasFilter && <button type="button" className="btn-outline" onClick={() => { setF({ q: "", status: "", source: "", pay: "", from: "", to: "", sort: f.sort }); router.push(qs({ q: "", status: "", source: "", pay: "", from: "", to: "", page: 1 })); }}>Clear filters</button>}
        </div>
      </form>

      {orders.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          {hasFilter ? "No inbox orders match these filters." : <><p className="text-3xl">📥</p><p className="mt-2 font-medium text-gray-700">No inbox orders yet</p><p className="text-sm">Click “+ Add Inbox Order” to record an order you received in a message.</p></>}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="rtable w-full min-w-[960px] text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Source</th><th className="p-3">Products</th><th className="p-3">Payment</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => {
                const first = o.items[0], more = o.items.length - 1;
                const tone = o.payment_status === "Paid" ? "bg-green-100 text-green-800" : o.payment_status === "Refunded" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700";
                return (
                  <tr key={`${o.id}-${o.status}`} className="align-middle">
                    <td data-label="Order" className="p-3"><p className="font-mono text-xs font-semibold">{o.order_no}</p><p className="text-xs text-gray-500">{formatIst(o.created_at)}</p></td>
                    <td data-label="Customer" className="p-3"><p className="font-medium">{o.customer_name}</p><p className="text-xs text-gray-500">{o.phone}</p></td>
                    <td data-label="Source" className="p-3"><span className="whitespace-nowrap rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">{SRC_ICON[o.source]} {o.source}</span></td>
                    <td data-label="Products" className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <Img src={first?.image_url || ""} alt={first?.title || "Order"} sizes="48px" className="h-12 w-12 rounded-lg object-cover" />
                          {more > 0 && <span className="absolute -bottom-1 -right-1 rounded-full bg-brand-700 px-1.5 text-[10px] font-semibold text-white">+{more}</span>}
                        </div>
                        <p className="max-w-[14rem] truncate font-medium">{first?.title || "Order"}{more > 0 && <span className="font-normal text-gray-500"> and {more} more</span>}</p>
                      </div>
                    </td>
                    <td data-label="Payment" className="p-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{o.payment_method} · {o.payment_status}</span></td>
                    <td data-label="Total" className="p-3 font-bold text-brand-700">{inr(o.total)}</td>
                    <td data-label="Status" className="p-3"><StatusSelect inbox label={o.order_no} id={o.id} status={o.status} /></td>
                    <td data-label="Action" className="p-3"><div className="flex justify-end gap-1.5">
                      <IconBtn kind="view" label={`View ${o.order_no}`} onClick={() => setModal({ kind: "view", id: o.id })} />
                      <IconBtn kind="edit" label={`Edit ${o.order_no}`} onClick={() => setModal({ kind: "form", id: o.id })} />
                      <IconBtn kind="delete" label={`Delete ${o.order_no}`} disabled={busy === o.id} onClick={() => setModal({ kind: "delete", id: o.id })} />
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={pi.page} totalPages={pi.totalPages} total={pi.total} hrefFor={(p) => qs({ page: p })} />

      {modal?.kind === "form" && (modal.id ? cur : true) && (
        <Dialog title={modal.id ? `Edit ${cur?.order_no}` : "Add Inbox Order"} onClose={() => setModal(null)} wide>
          <OrderForm order={cur} products={products} onCancel={() => setModal(null)} onSaved={(msg) => { setModal(null); toast.success(msg); router.refresh(); }} />
        </Dialog>
      )}
      {modal?.kind === "view" && cur && (
        <Dialog title={cur.order_no} onClose={() => setModal(null)} wide>
          <Detail o={cur} busy={busy === cur.id} onPatch={(b, m) => patch(cur, b, m)} onEdit={() => setModal({ kind: "form", id: cur.id })} onDelete={() => setModal({ kind: "delete", id: cur.id })} />
        </Dialog>
      )}
      {modal?.kind === "delete" && cur && (
        <Dialog title="Delete this order?" onClose={() => setModal(null)}>
          <p className="text-sm text-gray-600">Delete <b>{cur.order_no}</b> ({cur.customer_name}, {inr(cur.total)}) and its history permanently? This cannot be undone.</p>
          <div className="mt-5 flex justify-end gap-2"><button className="btn-outline" onClick={() => setModal(null)}>Cancel</button><button className="btn-danger" disabled={busy === cur.id} onClick={() => remove(cur)}>{busy === cur.id ? "Deleting…" : "Yes, delete"}</button></div>
        </Dialog>
      )}
    </div>
  );
}

function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose]);
  if (!mounted) return null;
  // Rendered on <body>: inside the page, the fade-in wrapper (app/template.tsx) traps a fixed overlay below the site header.
  return createPortal(
    <div className={`fixed inset-0 z-[100] flex bg-black/50 ${wide ? "" : "items-end justify-center sm:items-center sm:p-4"}`} onClick={wide ? undefined : onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`flex w-full flex-col overflow-hidden bg-white shadow-xl ${wide ? "h-[100dvh]" : "max-h-[100dvh] max-w-md rounded-t-2xl sm:max-h-[90vh] sm:rounded-2xl"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b bg-white px-4 py-3 sm:px-8">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-gray-500 hover:bg-gray-100">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={`p-4 sm:p-8 ${wide ? "mx-auto max-w-4xl" : ""}`}>{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Detail({ o, busy, onPatch, onEdit, onDelete }: { o: InboxOrder; busy: boolean; onPatch: (b: Record<string, string>, msg: string) => void; onEdit: () => void; onDelete: () => void }) {
  const [track, setTrack] = useState(o.tracking_number);
  const [notes, setNotes] = useState(o.notes);
  const addr = [o.house_name, o.street_name, o.city, o.state, o.pincode].filter(Boolean).join(", ");
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2"><Badge v={o.status} /><Badge v={o.payment_status} /><span className="text-gray-500">{SRC_ICON[o.source]} {o.source} · {dmy(o.order_date)}</span></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <section><h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Customer</h3><p className="font-medium">{o.customer_name}</p><a className="text-brand-700 hover:underline" href={`tel:${o.phone}`}>{o.phone}</a><p className="mt-1 text-gray-600">{addr || "No address given"}</p>{o.instructions && <p className="mt-1 text-gray-500">Note: {o.instructions}</p>}</section>
        <section><h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Payment</h3><p>{o.payment_method}</p><p className="text-gray-500">Created {formatIst(o.created_at)}</p></section>
      </div>
      <section>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Products</h3>
        <ul className="divide-y rounded-lg border">
          {o.items.map((i, n) => (
            <li key={n} className="flex items-center gap-3 p-2.5">
              {i.image_url ? <Img src={i.image_url} alt={i.title} sizes="48px" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="h-12 w-12 shrink-0 rounded-lg bg-gray-100" />}
              <span className="min-w-0 flex-1">{i.title}<span className="block text-xs text-gray-500">{i.qty} × {inr(i.price)}</span></span><b>{inr(i.qty * i.price)}</b>
            </li>
          ))}
        </ul>
        <dl className="mt-2 ml-auto max-w-xs space-y-0.5">{(o.delivery_charge > 0 || o.discount > 0) && <Row k="Subtotal" v={inr(o.subtotal)} />}{o.delivery_charge > 0 && <Row k="Delivery" v={inr(o.delivery_charge)} />}{o.discount > 0 && <Row k="Discount" v={"−" + inr(o.discount)} />}<Row k="Total" v={inr(o.total)} bold /></dl>
      </section>
      <section className="grid gap-3 rounded-lg bg-gray-50 p-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-gray-500">Order status
          <select className="input mt-1" disabled={busy} value={o.status} onChange={(e) => onPatch({ status: e.target.value }, `Status: ${e.target.value}`)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="block text-xs font-semibold text-gray-500">Payment status
          <select className="input mt-1" disabled={busy} value={o.payment_status} onChange={(e) => onPatch({ payment_status: e.target.value }, `Payment: ${e.target.value}`)}>{PAY_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <div className="sm:col-span-2"><label className="block text-xs font-semibold text-gray-500">Tracking number</label>
          <div className="mt-1 flex gap-2"><input className="input" maxLength={60} value={track} onChange={(e) => setTrack(e.target.value)} placeholder="Courier / tracking number" /><button className="btn-outline shrink-0" disabled={busy || track.trim() === o.tracking_number} onClick={() => onPatch({ tracking_number: track }, "Tracking number saved")}>Save</button></div></div>
        <div className="sm:col-span-2"><label className="block text-xs font-semibold text-gray-500">Internal notes</label>
          <textarea className="input mt-1" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Only you can see this" />
          <button className="btn-outline mt-2" disabled={busy || notes.trim() === o.notes} onClick={() => onPatch({ notes }, "Notes saved")}>Save notes</button></div>
      </section>
      <section>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">History</h3>
        <ol className="space-y-1.5 border-l-2 border-brand-200 pl-3">{o.history.map((h, n) => <li key={n}><p>{h.event}</p><p className="text-xs text-gray-400">{formatIst(h.created_at)}{h.actor ? ` · ${h.actor}` : ""}</p></li>)}</ol>
      </section>
      <div className="flex justify-end gap-2 border-t pt-4"><button className="btn-outline" onClick={onEdit}>Edit order</button><button className="btn border border-red-300 text-red-600 hover:bg-red-50" onClick={onDelete}>Delete</button></div>
    </div>
  );
}
const Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => <div className={`flex justify-between gap-6 ${bold ? "border-t pt-1 font-bold" : "text-gray-600"}`}><dt>{k}</dt><dd>{v}</dd></div>;

type Line = { key: number; product_id: number | null; title: string; qty: string; price: string; image_url: string; legacy: boolean; clamped?: boolean };
let lineKey = 1;
const blank = (): Line => ({ key: lineKey++, product_id: null, title: "", qty: "1", price: "", image_url: "", legacy: false });
const numOr0 = (s: string) => (s.trim() === "" ? 0 : Number(s));

function OrderForm({ order, products, onCancel, onSaved }: { order?: InboxOrder; products: PickProduct[]; onCancel: () => void; onSaved: (msg: string) => void }) {
  const [v, setV] = useState({
    customer_name: order?.customer_name ?? "", phone: order?.phone ?? "", house_name: order?.house_name ?? "", street_name: order?.street_name ?? "", city: order?.city ?? "", state: order?.state ?? "Kerala",
    pincode: order?.pincode ?? "", instructions: order?.instructions ?? "", source: order?.source ?? "Instagram", order_date: order?.order_date ?? istDay(), payment_method: order?.payment_method ?? "Cash on Delivery",
    payment_status: order?.payment_status ?? "Pending", status: order?.status ?? "Pending", tracking_number: order?.tracking_number ?? "", notes: order?.notes ?? "",
    delivery_charge: String(order?.delivery_charge ?? 0), discount: String(order?.discount ?? 0),
  });
  const [lines, setLines] = useState<Line[]>(order ? order.items.map((i) => ({ key: lineKey++, product_id: i.product_id, title: i.title, qty: String(i.qty), price: String(i.price), image_url: i.image_url, legacy: i.product_id === null })) : [blank()]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, val: string) => setV((p) => ({ ...p, [k]: val }));
  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const total = Math.max(0, subtotal + numOr0(v.delivery_charge) - numOr0(v.discount));

  function choose(key: number, p: PickProduct) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, product_id: p.id, title: p.title, price: String(p.price), image_url: p.image_url, legacy: false, clamped: false, qty: String(Math.min(Number(l.qty) || 1, Math.max(1, p.stock))) } : l)));
  }
  /** Digits only, no leading zeros; a new order can't ask for more than the store has (the number snaps back to the stock and says so). */
  function changeQty(key: number, raw: string, p?: PickProduct) {
    let n = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 4);
    let clamped = false;
    if (p && !order && n && Number(n) > p.stock) { n = String(Math.max(p.stock, 0)); clamped = true; }
    setLine(key, { qty: n, clamped });
  }
  const qtyErr = (l: Line, p?: PickProduct): string | null =>
    l.clamped && p ? `Only ${p.stock} in stock — set to ${p.stock}` : l.qty === "" || Number(l.qty) < 1 ? "Enter a quantity of 1 or more" : null;

  function clientCheck() {
    const e: Record<string, string> = {};
    if (v.customer_name.trim().length < 2) e.customer_name = "Full name is required";
    if (!v.phone.trim()) e.phone = "Phone number is required"; else if (!/^[6-9]\d{9}$/.test(v.phone.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))) e.phone = "Enter a valid 10-digit Indian mobile number";
    if (v.pincode.trim() && !/^[1-9]\d{5}$/.test(v.pincode.trim())) e.pincode = "PIN code must be 6 digits";
    if (!v.order_date) e.order_date = "Order date is required";
    if (lines.some((l) => !l.product_id && !l.legacy)) e.items = "Select a product for every line";
    else if (lines.some((l) => !Number.isInteger(Number(l.qty)) || Number(l.qty) < 1)) e.items = "Quantity must be a whole number, at least 1";
    else if (!order) { const over = lines.find((l) => { const p = products.find((x) => x.id === l.product_id); return p && Number(l.qty) > p.stock; }); if (over) { const p = products.find((x) => x.id === over.product_id)!; e.items = p.stock <= 0 ? `“${p.title}” is out of stock` : `Only ${p.stock} of “${p.title}” in stock`; } }
    return e;
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ce = clientCheck(); setErrs(ce);
    if (Object.keys(ce).length) return toast.error(Object.values(ce)[0]);
    setBusy(true);
    const body = { ...v, delivery_charge: numOr0(v.delivery_charge), discount: numOr0(v.discount), items: lines.map((l) => ({ product_id: l.product_id, title: l.title, qty: Number(l.qty), price: numOr0(l.price), image_url: l.image_url })) };
    const r = await fetch(order ? `/api/admin/inbox-orders/${order.id}` : "/api/admin/inbox-orders", { method: order ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { if (d.errors) setErrs(d.errors); return toast.error(d.error || "Could not save the order"); }
    onSaved(order ? "Order updated" : `Order ${d.order_no} saved`);
  }
  const text = (k: keyof typeof v, label: string, o: { req?: boolean; ph?: string; max?: number; type?: string; mode?: "numeric" | "tel" } = {}) => (
    <label className="block text-sm font-medium">{label}{o.req && <Req />}
      <input className={`input mt-1 ${errs[k] ? "!border-red-500" : ""}`} type={o.type ?? "text"} inputMode={o.mode} maxLength={o.max} placeholder={o.ph} value={v[k]} onChange={(e) => set(k, e.target.value)} />
      <FieldError msg={errs[k]} /></label>
  );
  const sel = (k: keyof typeof v, label: string, list: readonly string[]) => (
    <label className="block text-sm font-medium">{label}<select className="input mt-1" value={v[k]} onChange={(e) => set(k, e.target.value)}>{list.map((s) => <option key={s}>{s}</option>)}</select></label>
  );
  const H = ({ children }: { children: React.ReactNode }) => <h3 className="border-b pb-1 text-sm font-bold uppercase tracking-wide text-gray-500">{children}</h3>;

  return (
    <form onSubmit={save} noValidate className="space-y-5">
      <H>Customer details</H>
      <div className="grid gap-3 sm:grid-cols-2">
        {text("customer_name", "Full name", { req: true, max: 60 })}
        {text("phone", "Phone number", { req: true, max: 15, mode: "tel", ph: "10-digit mobile" })}
        {text("house_name", "House / building name", { max: 80 })}
        {text("street_name", "Street / locality", { max: 100 })}
        {text("city", "City", { max: 50 })}
        {text("state", "State", { max: 50 })}
        {text("pincode", "PIN code", { max: 6, mode: "numeric" })}
        <label className="block text-sm font-medium sm:col-span-2">Delivery instructions<textarea className="input mt-1" rows={2} maxLength={300} placeholder="Optional" value={v.instructions} onChange={(e) => set("instructions", e.target.value)} /></label>
      </div>

      <H>Products</H>
      <div className="space-y-3">
        {lines.map((l, n) => {
          const p = products.find((x) => x.id === l.product_id);
          const qty = Number(l.qty) || 0, price = Number(l.price) || 0;
          return (
            <div key={l.key} className="space-y-3 rounded-lg border bg-gray-50 p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {l.legacy
                    ? <div className="flex items-center gap-3 rounded-lg border bg-white p-2">{l.image_url ? <Img src={l.image_url} alt="" sizes="56px" className="h-14 w-14 shrink-0 rounded-lg object-cover" /> : <span className="h-14 w-14 shrink-0 rounded-lg bg-gray-100" />}<span className="min-w-0"><span className="block truncate font-medium">{l.title}</span><span className="text-xs text-gray-500">Added by hand earlier — remove it to pick a store product</span></span></div>
                    : <ProductPicker products={products} value={p ?? null} onPick={(x) => choose(l.key, x)} />}
                </div>
                {lines.length > 1 && <button type="button" aria-label={`Remove product ${n + 1}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-300 bg-white text-red-600 hover:bg-red-50" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>✕</button>}
              </div>
              {(p || l.legacy) && (
                <div className="grid grid-cols-3 items-end gap-2">
                  <label className="text-xs font-semibold text-gray-500">Quantity<Req />
                    <input className={`input mt-1 ${qtyErr(l, p) ? "!border-red-500" : ""}`} inputMode="numeric" aria-invalid={!!qtyErr(l, p)} value={l.qty}
                      onChange={(e) => changeQty(l.key, e.target.value, p)} onBlur={() => !l.qty && setLine(l.key, { qty: "1", clamped: false })} />
                    {qtyErr(l, p)
                      ? <span role="alert" className="mt-0.5 block text-[11px] font-medium text-red-600">{qtyErr(l, p)}</span>
                      : p && !order && <span className="mt-0.5 block text-[11px] font-normal text-gray-400">In stock: {p.stock}</span>}</label>
                  <div className="text-xs font-semibold text-gray-500">Price<p className="mt-1 py-2 text-sm font-medium text-gray-900">{inr(price)}</p></div>
                  <div className="text-xs font-semibold text-gray-500">Line total<p className="mt-1 py-2 text-sm font-bold text-gray-900">{inr(qty * price)}</p></div>
                </div>
              )}
            </div>
          );
        })}
        <FieldError msg={errs.items} />
        {lines.length < 20 && <button type="button" className="btn-outline" onClick={() => setLines((ls) => [...ls, blank()])}>+ Add another product</button>}
      </div>
      <div className="rounded-lg bg-brand-50 p-3 text-sm sm:max-w-xs"><p className="text-gray-500">Total amount</p><p className="text-2xl font-extrabold text-brand-700">{inr(total)}</p></div>

      <H>Order information</H>
      <div className="grid gap-3 sm:grid-cols-2">
        {sel("source", "Order source", SOURCES)}
        {text("order_date", "Order date", { type: "date", req: true })}
        {sel("payment_method", "Payment method", PAY_METHODS)}
        {sel("payment_status", "Payment status", PAY_STATUSES)}
        {sel("status", "Order status", STATUSES)}
        {text("tracking_number", "Tracking number", { max: 60, ph: "Optional" })}
        <label className="block text-sm font-medium sm:col-span-2">Notes<textarea className="input mt-1" rows={2} maxLength={1000} placeholder="Internal notes — optional" value={v.notes} onChange={(e) => set("notes", e.target.value)} /></label>
      </div>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-white px-4 py-3 sm:-mx-8 sm:-mb-8 sm:px-8">
        <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save Order"}</button>
      </div>
    </form>
  );
}

/** Store product chooser: shows each product's front photo, name, price and stock. Out-of-stock products can't be picked. */
function ProductPicker({ products, value, onPick }: { products: PickProduct[]; value: PickProduct | null; onPick: (p: PickProduct) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = products.filter((p) => p.title.toLowerCase().includes(q.trim().toLowerCase()));
  const thumb = (p: PickProduct, size: string) => (p.image_url ? <Img src={p.image_url} alt="" sizes="56px" className={`${size} shrink-0 rounded-lg object-cover`} /> : <span className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-gray-200`}>🛍️</span>);
  const stockTag = (p: PickProduct) => <span className={`text-xs font-semibold ${p.stock <= 0 ? "text-red-600" : p.stock <= 5 ? "text-amber-600" : "text-green-700"}`}>{p.stock <= 0 ? "Out of stock" : `Stock: ${p.stock}`}</span>;
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`flex w-full items-center gap-3 rounded-lg border bg-white p-2 text-left ${open ? "border-brand-600 ring-2 ring-brand-200" : "border-gray-300"}`}>
        {value ? <>{thumb(value, "h-14 w-14")}<span className="min-w-0 flex-1"><span className="block truncate font-medium">{value.title}</span><span className="flex items-center gap-2 text-xs text-gray-500">{inr(value.price)} · {stockTag(value)}</span></span></>
          : <><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xl">🛍️</span><span className="flex-1 text-gray-500">Select a product…</span></>}
        <span aria-hidden className="pr-1 text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-1 rounded-lg border bg-white shadow-sm">
          <input autoFocus className="input !rounded-b-none !border-0 !border-b" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="max-h-64 overflow-y-auto" role="listbox">
            {list.map((p) => (
              <li key={p.id}>
                <button type="button" role="option" aria-selected={value?.id === p.id} disabled={p.stock <= 0} onClick={() => { onPick(p); setOpen(false); setQ(""); }}
                  className="flex w-full items-center gap-3 border-b p-2 text-left last:border-0 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50">
                  {thumb(p, "h-12 w-12")}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.title}</span><span className="flex items-center gap-2 text-xs text-gray-500">{inr(p.price)} · {stockTag(p)}</span></span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="p-4 text-center text-sm text-gray-500">No products found</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
