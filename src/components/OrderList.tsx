import { inr } from "@/lib/types";
export type OrderRow = Record<string, any>;
export function Items({ json }: { json: string }) {
  let items: any[] = [];
  try { items = JSON.parse(json); } catch {}
  return (
    <ul className="text-sm text-gray-700">
      {items.map((i, n) => <li key={n}>{i.title}{i.size && ` (${i.size})`} × {i.qty} — {inr(i.price * i.qty)}</li>)}
    </ul>
  );
}
export const statusColor = (s: string) =>
  s === "Delivered" ? "bg-green-100 text-green-800" : s === "Cancelled" ? "bg-red-100 text-red-700" : s === "Shipped" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800";
