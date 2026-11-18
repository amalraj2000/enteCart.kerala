import type { CartItem } from "./types";

/** Reasons the given lines can't be ordered right now. Stock is per PRODUCT, so all sizes of one product count together. */
export function stockProblems(items: CartItem[]): string[] {
  const by = new Map<number, { title: string; stock: number; qty: number }>();
  for (const x of items) {
    const e = by.get(x.id) ?? { title: x.title, stock: x.stock, qty: 0 };
    e.qty += x.qty;
    by.set(x.id, e);
  }
  const out: string[] = [];
  for (const e of by.values()) {
    if (e.stock <= 0) out.push(`“${e.title}” is out of stock`);
    else if (e.qty > e.stock) out.push(`Only ${e.stock} of “${e.title}” available (you have ${e.qty})`);
  }
  return out;
}
