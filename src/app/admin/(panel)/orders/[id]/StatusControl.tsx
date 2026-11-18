"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/Toaster";

export default function StatusControl({ id, status, statuses }: { id: number; status: string; statuses: string[] }) {
  const router = useRouter();
  const [v, setV] = useState(status);
  return (
    <label className="flex items-center gap-2 text-sm text-gray-500">Update status
      <select className="input !w-auto !py-1.5" value={v} onChange={async (e) => {
        const prev = v, next = e.target.value; setV(next);
        const r = await fetch(`/api/admin/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
        if (r.ok) { toast.success(`Order #${id} marked ${next}`); router.refresh(); } else { setV(prev); toast.error("Could not update status"); }
      }}>
        {statuses.map((s) => <option key={s}>{s}</option>)}
      </select>
    </label>
  );
}
