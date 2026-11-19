"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/Toaster";

/** Owner's on/off switch for "Pay Online" at checkout. */
export default function OnlineToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  async function flip() {
    const next = !on;
    if (!next && !confirm("Turn OFF online payment? Customers will only see Cash on Delivery at checkout. Orders already waiting for payment can still be paid.")) return;
    setBusy(true);
    const r = await fetch("/api/admin/payments/toggle", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: next }) });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return toast.error(d.error || "Could not change the setting");
    setOn(next); toast.success(next ? "Online payment is ON" : "Online payment is OFF — checkout shows Cash on Delivery only"); router.refresh();
  }
  return (
    <div className="card flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="font-semibold">Online payment at checkout</p>
        <p className="text-sm text-gray-500">{on ? "Customers can choose Pay Online (Razorpay) or Cash on Delivery." : "Hidden — customers can only choose Cash on Delivery."}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label="Online payment" disabled={busy} onClick={flip}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-brand-600" : "bg-gray-300"} ${busy ? "opacity-60" : ""}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
