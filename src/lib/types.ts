export type Category = { id: number; name: string; count?: number };
export type Product = {
  created_by?: number | null;
  added_by_name?: string | null; // admin who added it (joined for the admin product list)
  category_id?: number | null;
  category_name?: string | null;
  images?: string; // JSON array of URLs; image_url is always the first one
  id: number; title: string; description: string; price: number;
  stock: number; sizes: string; image_url: string;
};
export type CartItem = { id: number; title: string; price: number; image_url: string; size: string; qty: number; stock: number };
export const ORDER_STATUSES = ["Placed", "Confirmed", "Shipped", "Delivered", "Cancelled"];
export const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN");

/** All photos of a product (first = main). Falls back to the single image_url for older products. */
export function productImages(p: { images?: string; image_url?: string }): string[] {
  try {
    const a = JSON.parse(p.images || "[]");
    if (Array.isArray(a) && a.length) return a.filter((x) => typeof x === "string" && x);
  } catch {}
  return p.image_url ? [p.image_url] : [];
}
