import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/session";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import { inr } from "@/lib/types";
import Pagination from "@/components/Pagination";
import RefundButton from "./RefundButton";

export const dynamic = "force-dynamic";
const FILTERS = ["All", "Paid", "Refund due", "Refunded", "Not completed"] as const;
const WHERE: Record<string, string> = { Paid: "p.status = 'Paid' AND o.status != 'Cancelled'", "Refund due": "p.status = 'Paid' AND o.status = 'Cancelled'", Refunded: "p.status = 'Refunded'", "Not completed": "p.status = 'Created'" };
const badge: Record<string, string> = { Paid: "bg-green-100 text-green-800", Refunded: "bg-blue-100 text-blue-800", Created: "bg-gray-100 text-gray-600", Refunding: "bg-amber-100 text-amber-800" };

/** Online payment transactions — super admin only. */
export default async function Payments({ searchParams }: { searchParams: Promise<{ page?: string; f?: string }> }) {
  if (!(await getSuperAdmin())) notFound();
  const sp = await searchParams;
  const f = FILTERS.find((x) => x === sp.f) ?? "All";
  const where = f === "All" ? "1=1" : WHERE[f];
  const c = await db();
  const from = "FROM payments p JOIN orders o ON o.id = p.order_id";
  const total = Number((await c.execute(`SELECT COUNT(*) n ${from} WHERE ${where}`)).rows[0].n);
  const sums = (await c.execute(`SELECT COALESCE(SUM(CASE WHEN p.status='Paid' THEN p.amount END),0) paid, COALESCE(SUM(CASE WHEN p.status='Paid' AND o.status='Cancelled' THEN p.amount END),0) due, COALESCE(SUM(CASE WHEN p.status='Refunded' THEN p.amount END),0) refunded ${from}`)).rows[0];
  const pi = pageInfo(total, parsePage(sp.page));
  const rows = (await c.execute({
    sql: `SELECT p.*, o.status AS order_status, o.customer_name, o.phone ${from} WHERE ${where} ORDER BY p.id DESC LIMIT ${PAGE_SIZE} OFFSET ?`, args: [pi.offset],
  })).rows;
  const href = (x: string, page = 1) => `/admin/payments?${new URLSearchParams({ ...(x !== "All" ? { f: x } : {}), ...(page > 1 ? { page: String(page) } : {}) })}`;
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold">Online payments</h1><p className="text-sm text-gray-500">Razorpay transactions. Card numbers are never stored — only ids, amount and payment method.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        {([["Collected (not refunded)", Number(sums.paid)], ["Refund due (cancelled orders)", Number(sums.due)], ["Refunded", Number(sums.refunded)]] as const).map(([l, v]) => (
          <div key={l} className="card p-4"><p className="text-xs text-gray-500">{l}</p><p className="text-lg font-bold text-brand-700">{inr(v)}</p></div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((x) => <Link key={x} href={href(x)} className={`rounded-full border px-3 py-1.5 text-sm ${f === x ? "border-brand-600 bg-brand-600 text-white" : "bg-white hover:bg-brand-50"}`}>{x}</Link>)}
      </div>
      {rows.length === 0 ? <div className="card p-10 text-center text-gray-500">No payments here yet.</div> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr>
              <th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Amount</th><th className="p-3">Method</th><th className="p-3">Razorpay IDs</th><th className="p-3">Status</th><th className="p-3">Date</th><th className="p-3" />
            </tr></thead>
            <tbody className="divide-y">
              {rows.map((p) => {
                const due = p.status === "Paid" && p.order_status === "Cancelled";
                return (
                  <tr key={Number(p.id)} className="align-top">
                    <td className="p-3"><Link className="font-semibold text-brand-700 hover:underline" href={`/admin/orders/${p.order_id}`}>#{String(p.order_id)}</Link><div className="text-xs text-gray-500">{String(p.order_status)}</div></td>
                    <td className="p-3">{String(p.customer_name)}<div className="text-xs text-gray-500">{String(p.phone)}</div></td>
                    <td className="p-3 font-semibold">{inr(Number(p.amount))}</td>
                    <td className="p-3">{p.method ? <span className="capitalize">{String(p.method)}</span> : "—"}<div className="text-xs text-gray-500">{String(p.method_detail || "")}</div></td>
                    <td className="p-3 font-mono text-xs text-gray-600"><div>{String(p.razorpay_order_id)}</div><div>{String(p.razorpay_payment_id) || "—"}</div>{p.refund_id ? <div className="text-blue-700">{String(p.refund_id)}</div> : null}</td>
                    <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge[String(p.status)] || ""}`}>{String(p.status) === "Created" ? "Not completed" : String(p.status)}</span>{due && <div className="mt-1 text-xs font-semibold text-red-600">Refund due</div>}</td>
                    <td className="p-3 text-xs text-gray-500">{String(p.paid_at || p.created_at)}</td>
                    <td className="p-3">{due && <RefundButton id={Number(p.id)} amount={inr(Number(p.amount))} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={pi.page} totalPages={pi.totalPages} total={pi.total} hrefFor={(p) => href(f, p)} />
    </div>
  );
}
