import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { editableOrderIds } from "@/lib/permissions";
import { withImages } from "@/lib/orderItems";
import { ORDER_STATUSES } from "@/lib/types";
import OrderDetail from "@/components/OrderDetail";
import StatusControl from "./StatusControl";

export const dynamic = "force-dynamic";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireAdmin();
  const c = await db();
  const rows = (await c.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [Number(id) || 0] })).rows;
  if (!rows[0]) notFound();
  const editable = await editableOrderIds(c, me, [Number(rows[0].id)]); // sub admin: only if their product is in it
  const [o] = await withImages(rows, { admins: true });
  const canChange = editable.has(Number(o.id));
  return (
    <div className="space-y-4">
      <Link href="/admin/orders" className="text-sm font-medium text-brand-700 hover:underline">← Back to orders</Link>
      <OrderDetail o={o} admin actions={canChange
        ? <StatusControl id={o.id} status={o.status} statuses={ORDER_STATUSES} />
        : <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500" title="This order has none of your products">View only</span>} />
    </div>
  );
}
