import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { withImages } from "@/lib/orderItems";
import { ORDER_STATUSES } from "@/lib/types";
import OrderDetail from "@/components/OrderDetail";
import StatusControl from "./StatusControl";

export const dynamic = "force-dynamic";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db();
  const rows = (await c.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [Number(id) || 0] })).rows;
  if (!rows[0]) notFound();
  const [o] = await withImages(rows);
  return (
    <div className="space-y-4">
      <Link href="/admin/orders" className="text-sm font-medium text-brand-700 hover:underline">← Back to orders</Link>
      <OrderDetail o={o} admin actions={<StatusControl id={o.id} status={o.status} statuses={ORDER_STATUSES} />} />
    </div>
  );
}
