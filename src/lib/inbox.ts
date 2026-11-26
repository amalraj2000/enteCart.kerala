import type { Client } from "@libsql/client";
import { db } from "./db";
import { istDay } from "./istDate";
import { str, type Errors } from "./validate";

import { INBOX_KEY, MAX_LINES, PAY_METHODS, PAY_STATUSES, SOURCES, STATUSES } from "./inboxConsts";
export { INBOX_KEY, MAX_LINES, PAY_METHODS, PAY_STATUSES, SOURCES, STATUSES };

/** Owner's master switch (Admin → Settings → Inbox Orders). Stored in `settings` as "1"/"0"; missing = OFF (new feature is opt-in). */
export async function inboxEnabled(c?: Client): Promise<boolean> {
  const cl = c ?? (await db());
  const r = (await cl.execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [INBOX_KEY] })).rows[0];
  return String(r?.value ?? "0") === "1";
}

export type InboxItem = { product_id: number | null; title: string; qty: number; price: number; image_url: string };
export type InboxInput = {
  customer_name: string; phone: string; house_name: string; street_name: string; city: string; state: string; pincode: string; instructions: string;
  source: string; order_date: string; payment_method: string; payment_status: string; status: string; tracking_number: string; notes: string;
  delivery_charge: number; discount: number; items: InboxItem[];
};

const money = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : v === undefined || v === null || v === "" ? 0 : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};
const line = (v: unknown, max: number) => str(v).replace(/\s+/g, " ").slice(0, max);
const one = <T extends string>(v: unknown, list: readonly T[], dflt: T): T => (list as readonly string[]).includes(String(v)) ? (v as T) : dflt;

export function cleanInbox(b: Record<string, unknown>): InboxInput {
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, MAX_LINES + 1).map((raw): InboxItem => {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const pid = Number(r.product_id);
    return { product_id: Number.isInteger(pid) && pid > 0 ? pid : null, title: line(r.title, 150), qty: Number(r.qty), price: money(r.price), image_url: typeof r.image_url === "string" ? r.image_url.slice(0, 500) : "" };
  });
  return {
    customer_name: line(b.customer_name, 60), phone: str(b.phone).replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""),
    house_name: line(b.house_name, 80), street_name: line(b.street_name, 100), city: line(b.city, 50), state: line(b.state, 50), pincode: str(b.pincode).replace(/\s+/g, ""),
    instructions: str(b.instructions).slice(0, 300), source: one(b.source, SOURCES, "Other"), order_date: str(b.order_date) || istDay(),
    payment_method: one(b.payment_method, PAY_METHODS, "Cash on Delivery"), payment_status: one(b.payment_status, PAY_STATUSES, "Pending"), status: one(b.status, STATUSES, "Pending"),
    tracking_number: line(b.tracking_number, 60), notes: str(b.notes).slice(0, 1000), delivery_charge: money(b.delivery_charge), discount: money(b.discount), items,
  };
}

export function validateInbox(v: InboxInput, raw: Record<string, unknown>): Errors {
  const e: Errors = {};
  if (!v.customer_name) e.customer_name = "Full name is required"; else if (v.customer_name.length < 2) e.customer_name = "Full name must be at least 2 characters";
  if (!v.phone) e.phone = "Phone number is required"; else if (!/^[6-9]\d{9}$/.test(v.phone)) e.phone = "Enter a valid 10-digit Indian mobile number";
  if (v.pincode && !/^[1-9]\d{5}$/.test(v.pincode)) e.pincode = "PIN code must be 6 digits";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.order_date) || Number.isNaN(Date.parse(v.order_date + "T00:00:00Z")) || new Date(v.order_date + "T00:00:00Z").toISOString().slice(0, 10) !== v.order_date) e.order_date = "Enter a valid order date";
  if (typeof raw.source === "string" && !(SOURCES as readonly string[]).includes(raw.source)) e.source = "Choose a valid order source";
  if (Number.isNaN(v.delivery_charge) || v.delivery_charge < 0 || v.delivery_charge > 100000) e.delivery_charge = "Delivery charge must be 0 or more";
  if (Number.isNaN(v.discount) || v.discount < 0 || v.discount > 1_000_000) e.discount = "Discount must be 0 or more";
  if (v.items.length === 0) e.items = "Add at least one product";
  else if (v.items.length > MAX_LINES) e.items = `Maximum ${MAX_LINES} products per order`;
  else for (const it of v.items) {
    if (!it.title) { e.items = "Every product needs a name"; break; }
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 1000) { e.items = "Quantity must be a whole number from 1 to 1000"; break; }
    if (Number.isNaN(it.price) || it.price < 0 || it.price > 1_000_000) { e.items = "Product price must be 0 or more"; break; }
  }
  if (!e.items && !e.delivery_charge && !e.discount) {
    const t = totals(v);
    if (v.discount > t.subtotal + v.delivery_charge) e.discount = "Discount cannot be more than the order value";
  }
  return e;
}

/** Always computed on the server — the browser's total is never trusted. */
export function totals(v: Pick<InboxInput, "items" | "delivery_charge" | "discount">) {
  const subtotal = Math.round(v.items.reduce((s, i) => s + i.qty * i.price, 0) * 100) / 100;
  const total = Math.max(0, Math.round((subtotal + v.delivery_charge - v.discount) * 100) / 100);
  return { subtotal, total };
}

export { nextOrderNo } from "./orderNo";
