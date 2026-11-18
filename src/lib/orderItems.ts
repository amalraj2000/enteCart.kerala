import { db } from "./db";

export type OrderItem = { id: number; title: string; price: number; size?: string; qty: number; image_url: string };
export type FullOrder = Record<string, any> & { items: OrderItem[] };

/** Parses each order's items JSON and fills in product photos (older orders didn't store the image). */
export async function withImages(rows: any[]): Promise<FullOrder[]> {
  const c = await db();
  const imgs = new Map<number, string>();
  for (const p of (await c.execute("SELECT id, image_url FROM products")).rows) imgs.set(Number(p.id), String(p.image_url || ""));
  return rows.map((r) => {
    const o = JSON.parse(JSON.stringify(r));
    let items: any[] = [];
    try { items = JSON.parse(o.items); } catch {}
    return { ...o, items: items.map((i) => ({ ...i, image_url: i.image_url || imgs.get(Number(i.id)) || "" })) };
  });
}
