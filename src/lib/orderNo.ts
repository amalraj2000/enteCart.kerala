import { istDay } from "./istDate";

/** Shared, human-friendly order numbers "EC-2026-0001" for BOTH storefront orders and inbox orders. One yearly counter in `meta`. */
export const orderSeqKey = (year = istDay().slice(0, 4)) => `order_seq_${year}`;
const NO_SQL = "'EC-' || ? || '-' || printf('%04d', CAST((SELECT value FROM meta WHERE key = ?) AS INTEGER))";

/** Two statements for a write batch/transaction: bump the counter, then use `noSql` (+ `noArgs`) as the order_no value in the INSERT right after. */
export function orderNoParts() {
  const year = istDay().slice(0, 4), key = orderSeqKey(year);
  return {
    bump: { sql: "INSERT INTO meta (key, value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)", args: [key] as (string | number)[] },
    noSql: `(${NO_SQL})`,
    noArgs: [year, key] as (string | number)[],
  };
}

/** What to show for an order: its EC number, or the old #id for any row that somehow has none. */
export const orderLabel = (o: Record<string, any>) => (o.order_no ? String(o.order_no) : `#${String(o.id)}`);

type Tx = { execute: (s: { sql: string; args: (string | number)[] }) => Promise<{ rows: unknown[] }> };
/** Next number for an explicit year, used inside a transaction (inbox create + one-time backfill). */
export async function nextOrderNo(tx: Tx, year = istDay().slice(0, 4)): Promise<string> {
  const key = orderSeqKey(year);
  await tx.execute({ sql: "INSERT INTO meta (key, value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)", args: [key] });
  const r = (await tx.execute({ sql: "SELECT value FROM meta WHERE key = ?", args: [key] })).rows[0] as { value: unknown };
  return `EC-${year}-${String(Number(r.value)).padStart(4, "0")}`;
}
