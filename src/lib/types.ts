export type Category = { id: number; name: string; count?: number; status?: string };
export type Product = {
  created_by?: number | null;
  added_by_name?: string | null; // admin who added it (joined for the admin product list)
  category_id?: number | null;
  category_name?: string | null;
  status?: string; // "active" | "inactive" — inactive products are hidden from customers
  images?: string; // JSON array of URLs; image_url is always the first one
  id: number; title: string; description: string; price: number;
  stock: number; sizes: string; image_url: string;
  original_price?: number; // MRP / original price (0 = none); `price` is the selling price
};
export type CartItem = { id: number; title: string; price: number; image_url: string; size: string; qty: number; stock: number; original_price?: number };
export const ORDER_STATUSES = ["Placed", "Confirmed", "Shipped", "Delivered", "Cancelled"];
/** Discount % between the original (MRP) and selling price, rounded; 0 when there is no real discount. Always calculated, never stored. */
export const discountPct = (price: number, original?: number | null) => {
  const p = Number(price), o = Number(original);
  return o > 0 && p > 0 && o > p ? Math.round((1 - p / o) * 100) : 0;
};
export const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN");

/** All photos of a product (first = main). Falls back to the single image_url for older products. */
export function productImages(p: { images?: string; image_url?: string }): string[] {
  try {
    const a = JSON.parse(p.images || "[]");
    if (Array.isArray(a) && a.length) return a.filter((x) => typeof x === "string" && x);
  } catch {}
  return p.image_url ? [p.image_url] : [];
}
