import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { reconcilePayment } from "@/lib/reconcilePayment";
import { resolveOwnOrder } from "@/lib/orderRef";
export const dynamic = "force-dynamic";

export default async function Success({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Read the real payment state from the DB (and Razorpay, if still unpaid) — the URL alone proves nothing.
  let online = false, paid = false, found = false, shown = id;
  const user = await getUser();
  if (user) {
    const c = await db();
    const own = await resolveOwnOrder(c, user.id, id);
    if (own) {
      if (own.publicId && own.publicId !== id) redirect(`/order-success/${own.publicId}`); // old numeric link → opaque address
      const o = (await c.execute({ sql: "SELECT payment_method FROM orders WHERE id = ?", args: [own.id] })).rows[0];
      found = !!o; shown = String(own.id); // the customer-facing order NUMBER; only the link is opaque
      if (o?.payment_method === "online") { online = true; paid = (await reconcilePayment(c, own.id)) === "Paid"; }
    }
  }
  // Never show "Order placed!" for an order that doesn't exist or isn't yours (e.g. a typed/refreshed URL).
  if (!found) redirect("/orders");
  return (
    <div className="card mx-auto max-w-md p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl text-brand-700">{online && !paid ? "…" : "✓"}</div>
      <h1 className="mt-4 text-2xl font-bold text-brand-700">{online && !paid ? "Payment pending" : "Order placed!"}</h1>
      <p className="mt-2 text-gray-600">
        {!online ? <>Your order <b>#{shown}</b> has been confirmed. Please keep cash ready — payment is Cash on Delivery.</>
          : paid ? <>Your order <b>#{shown}</b> is confirmed and <b>paid online</b>. Thank you!</>
          : <>Your order <b>#{shown}</b> is saved, but we haven’t received the payment yet. If money was deducted, it will show here shortly — check My Orders.</>}
      </p>
      <p className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">You can cancel this order from <b>My Orders</b> while its status is “Placed”. Once it is confirmed, it can’t be cancelled, and returns are not available.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/orders" className="btn-primary">View my orders</Link>
        <Link href="/" className="btn-outline">Continue shopping</Link>
      </div>
    </div>
  );
}
