"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/Toaster";

export default function RefundButton({ id, amount }: { id: number; amount: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function refund() {
    if (!confirm(`Refund ${amount} to the customer's original payment method? This can't be undone.`)) return;
    setBusy(true);
    const r = await fetch(`/api/admin/payments/${id}/refund`, { method: "POST" });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (r.ok) toast.success("Refund started — the customer gets it in 5–7 working days"); else toast.error(d.error || "Refund failed");
    router.refresh();
  }
  return <button className="btn-danger !px-3 !py-1 text-xs" onClick={refund} disabled={busy}>{busy ? "Refunding…" : "Refund"}</button>;
}
