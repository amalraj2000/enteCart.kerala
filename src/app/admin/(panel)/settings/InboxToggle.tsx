"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/Toaster";

/** Settings switch for the Inbox Orders menu. Saved on the server at once; router.refresh() re-renders the admin layout so the sidebar updates without a reload. */
export default function InboxToggle({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    const next = !on;
    if (!next && !confirm("Turn OFF Inbox Orders? The menu is hidden and its pages and APIs are blocked. Your saved inbox orders are NOT deleted.")) return;
    setBusy(true);
    const r = await fetch("/api/admin/inbox-orders/toggle", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: next }) });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return toast.error(d.error || "Could not change the setting");
    setOn(next); toast.success(next ? "Inbox Orders is ON" : "Inbox Orders is OFF"); router.refresh();
  }
  return (
    <div className="card flex max-w-2xl items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="font-semibold">Inbox Orders Menu</p>
        <p className="text-sm text-gray-500">{on ? "ON — the Inbox Orders menu is shown in this admin panel." : "OFF — the menu is hidden and its pages are blocked. Saved orders are kept."}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label="Inbox Orders Menu" disabled={busy} onClick={toggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-brand-600" : "bg-gray-300"} ${busy ? "opacity-60" : ""}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
