"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/Toaster";
import { ORDER_STATUSES } from "@/lib/types";
import { STATUSES as INBOX_STATUSES } from "@/lib/inboxConsts";

const tone: Record<string, string> = {
  Pending: "border-amber-300 bg-amber-50 text-amber-800", Processing: "border-amber-400 bg-amber-100 text-amber-900", Placed: "border-amber-300 bg-amber-50 text-amber-800", Confirmed: "border-amber-400 bg-amber-100 text-amber-900",
  Shipped: "border-blue-300 bg-blue-50 text-blue-800", Delivered: "border-green-300 bg-green-50 text-green-800", Cancelled: "border-red-300 bg-red-50 text-red-700",
};

/** Compact status dropdown for the orders list. Saves on change; the page refreshes so counts and filters stay right. */
export default function StatusSelect({ id, status, label, inbox = false }: { id: number; status: string; label?: string; inbox?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(status);
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    const prev = v;
    setV(next); setBusy(true);
    const r = await fetch(inbox ? `/api/admin/inbox-orders/${id}` : `/api/admin/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    setBusy(false);
    if (r.ok) toast.success(`Order ${label || "#" + id} marked ${next}`);
    else { setV(prev); toast.error((await r.json().catch(() => ({}))).error || "Could not update status"); }
    router.refresh();
  }

  return (
    <select aria-label={`Status of order ${label || "#" + id}`} value={v} disabled={busy} onChange={(e) => change(e.target.value)}
      className={`rounded-full border px-3 py-1 text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60 ${tone[v] || ""}`}>
      {(inbox ? INBOX_STATUSES : ORDER_STATUSES).map((s) => <option key={s}>{s}</option>)}
    </select>
  );
}
