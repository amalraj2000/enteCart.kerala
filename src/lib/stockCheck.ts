import type { CartItem } from "./types";

/** Reasons the given lines can't be ordered right now. Stock is per PRODUCT, so all sizes of one product count together. */
export function stockProblems(items: CartItem[]): string[] {
  const by = new Map<number, { title: string; stock: number; qty: number; gone: boolean }>();
  for (const x of items) {
    const e = by.get(x.id) ?? { title: x.title, stock: x.stock, qty: 0, gone: !!x.gone };
    e.qty += x.qty;
    by.set(x.id, e);
  }
  const out: string[] = [];
  for (const e of by.values()) {
    if (e.gone) out.push(`“${e.title}” is no longer available — remove it to continue`);
    else if (e.stock <= 0) out.push(`“${e.title}” is out of stock`);
    else if (e.qty > e.stock) out.push(`Only ${e.stock} of “${e.title}” available (you have ${e.qty})`);
  }
  return out;
}
