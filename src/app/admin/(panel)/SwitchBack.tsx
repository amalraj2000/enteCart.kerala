"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toaster";

/** Shown on every admin page while a super admin is viewing the panel as a sub admin. */
export default function SwitchBack({ as, owner }: { as: string; owner: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function back() {
    setBusy(true);
    const r = await fetch("/api/admin/impersonate/stop", { method: "POST" });
    if (!r.ok) { setBusy(false); return toast.error((await r.json().catch(() => ({}))).error || "Could not switch back — please log in again"); }
    toast.success("Back to your super admin account");
    router.push("/admin/admins"); router.refresh();
  }
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
      <p>👁️ You are viewing the admin panel as <b>{as}</b> (sub admin). Signed in as {owner}.</p>
      <button type="button" className="btn-primary !min-h-0 !py-1.5 text-sm" onClick={back} disabled={busy}>{busy ? "Switching…" : "↩ Switch back to Super admin"}</button>
    </div>
  );
}
