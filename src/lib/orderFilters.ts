import type { Client } from "@libsql/client";
import { ORDER_STATUSES } from "./types";
import { istDay, isMonth, isRealDay } from "./istDate";
import { inboxEnabled } from "./inbox";

/** `from` / `to` (date range), `type` (website | inbox) and `pay` (payment status) are used only by the CSV export popup. */
export type OrderSp = { page?: string; status?: string; date?: string; month?: string; q?: string; from?: string; to?: string; type?: string; pay?: string };
export type Arg = string | number;

/**
 * The Orders list's filters (status chip, date / month / all dates, search) — ONE place used by the Orders page and its CSV export,
 * so the file always contains exactly what the filtered list shows. Inbox orders are included for the owner while Inbox Orders is ON
 * (their statuses are mapped onto the shop's: Pending → Placed, Processing → Confirmed).
 */
export async function buildOrderFilter(c: Client, role: string, sp: OrderSp) {
  const status = typeof sp.status === "string" && ORDER_STATUSES.includes(sp.status) ? sp.status : "All";
  const today = istDay();
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : ""; // order no, customer name, phone or email — across ALL dates unless a date is chosen
  const range: { kind: "day" | "month" | "all"; value: string } =
    sp.date === "all" ? { kind: "all", value: "" }
    : typeof sp.month === "string" && isMonth(sp.month) ? { kind: "month", value: sp.month }
    : typeof sp.date === "string" && isRealDay(sp.date) ? { kind: "day", value: sp.date }
    : q ? { kind: "all", value: "" } : { kind: "day", value: today };

  const dateSql = range.kind === "all" ? "1=1" : range.kind === "day" ? "date(created_at, '+330 minutes') = ?" : "strftime('%Y-%m', created_at, '+330 minutes') = ?";
  const dateArgs: Arg[] = range.kind === "all" ? [] : [range.value];
  // Export popup only: a from–to date range (either end may be left open) replaces the single day / month, plus type and payment filters.
  const from = typeof sp.from === "string" && isRealDay(sp.from) ? sp.from : "", to = typeof sp.to === "string" && isRealDay(sp.to) ? sp.to : "";
  const between = !!(from || to);
  const lo = from && to && from > to ? to : from, hi = from && to && from > to ? from : to; // swapped ends are fixed, not rejected
  let dateSql2 = dateSql;
  let dateArgs2 = dateArgs.slice(0, range.kind === "all" ? 0 : 1);
  let iDate2 = range.kind === "all" ? "1=1" : range.kind === "day" ? "order_date = ?" : "substr(order_date, 1, 7) = ?";
  let iDateArgs: Arg[] = range.kind === "all" ? [] : [range.value];
  if (between) {
    const w = (col: string) => [lo ? `${col} >= ?` : "", hi ? `${col} <= ?` : ""].filter(Boolean).join(" AND ");
    dateSql2 = w("date(created_at, '+330 minutes')"); iDate2 = w("order_date");
    dateArgs2 = [lo, hi].filter(Boolean); iDateArgs = [...dateArgs2];
  }
  const pay = typeof sp.pay === "string" && ["Pending", "Unpaid", "Paid", "Refunded"].includes(sp.pay) ? sp.pay : "";
  const type = sp.type === "website" || sp.type === "inbox" ? sp.type : "all";

  let searchSql = "1=1";
  const sArgs: Arg[] = [];
  if (q) {
    const l = `%${q.replace(/[%_]/g, "")}%`;
    searchSql = "(order_no LIKE ? OR customer_name LIKE ? OR phone LIKE ? OR user_id IN (SELECT id FROM users WHERE email LIKE ? OR name LIKE ?))";
    sArgs.push(l, l, l, l, l);
  }
  const where = `${dateSql2} AND ${searchSql}${pay ? " AND payment_status = ?" : ""}`;
  const dateArgsW: Arg[] = [...dateArgs2, ...sArgs, ...(pay ? [pay] : [])];

  const withInbox = role === "admin" && (await inboxEnabled(c));
  let iSearch = "1=1";
  const iSArgs: Arg[] = [];
  if (q) { const l = `%${q.replace(/[%_]/g, "")}%`; iSearch = "(order_no LIKE ? OR customer_name LIKE ? OR phone LIKE ?)"; iSArgs.push(l, l, l); }
  const iWhere = `${iDate2} AND ${iSearch}${pay ? " AND payment_status = ?" : ""}`;
  const iArgs: Arg[] = [...iDateArgs, ...iSArgs, ...(pay ? [pay] : [])];
  const MAP = "CASE status WHEN 'Pending' THEN 'Placed' WHEN 'Processing' THEN 'Confirmed' ELSE status END";
  const webPart = `SELECT 'w' AS k, id, status, created_at FROM orders WHERE ${where}`;
  const inboxPart = `SELECT 'i' AS k, id, ${MAP} AS status, created_at FROM inbox_orders WHERE ${iWhere}`;
  // type: all = website + inbox (inbox only for the owner while the switch is ON), website = only website, inbox = only inbox (nothing when the switch is OFF)
  const useWeb = type !== "inbox", useInbox = withInbox && type !== "website";
  const all = [useWeb ? webPart : "", useInbox ? inboxPart : ""].filter(Boolean).join(" UNION ALL ") || `${webPart} AND 1=0`;
  const allArgs: Arg[] = !useWeb && !useInbox ? dateArgsW : [...(useWeb ? dateArgsW : []), ...(useInbox ? iArgs : [])];
  const outRange = between ? { kind: "all" as const, value: "" } : range;
  const dateArgsOut = dateArgsW;
  return { status, q, today, range: outRange, where, dateArgs: dateArgsOut, withInbox, iWhere, iArgs, all, allArgs };
}
