"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type Range = { kind: "day" | "month" | "all"; value: string };

/** Date controls for the Orders list: quick chips, a day picker with ‹ › arrows, and a month picker. Defaults to today (set by the page). */
export default function DateFilter({ range, today, yesterday, thisMonth, status }: { range: Range; today: string; yesterday: string; thisMonth: string; status: string }) {
  const router = useRouter();
  const href = (p: Record<string, string>) => `/admin/orders?${new URLSearchParams({ ...p, ...(status !== "All" ? { status } : {}) })}`;
  const go = (p: Record<string, string>) => router.push(href(p));
  const shift = (days: number) => { const d = new Date(range.value + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); go({ date: d.toISOString().slice(0, 10) }); };

  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand-600 bg-brand-600 text-white" : "bg-white hover:bg-brand-50"}`;
  const isDay = range.kind === "day";
  return (
    <div className="card flex flex-wrap items-center gap-2 p-3">
      <Link href={href({ date: today })} className={chip(isDay && range.value === today)}>Today</Link>
      <Link href={href({ date: yesterday })} className={chip(isDay && range.value === yesterday)}>Yesterday</Link>
      <Link href={href({ month: thisMonth })} className={chip(range.kind === "month" && range.value === thisMonth)}>This month</Link>
      <Link href={href({ date: "all" })} className={chip(range.kind === "all")}>All dates</Link>

      <span className="mx-1 hidden h-6 w-px bg-gray-200 sm:block" aria-hidden />
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Previous day" disabled={!isDay} onClick={() => shift(-1)} className="btn border !px-2.5 !py-1.5 disabled:opacity-30">‹</button>
        <input type="date" aria-label="Pick a date" className="input !w-auto !py-1.5" max={today} value={isDay ? range.value : ""}
          onChange={(e) => e.target.value && go({ date: e.target.value })} />
        <button type="button" aria-label="Next day" disabled={!isDay || range.value >= today} onClick={() => shift(1)} className="btn border !px-2.5 !py-1.5 disabled:opacity-30">›</button>
      </div>
      <input type="month" aria-label="Pick a month" className="input !w-auto !py-1.5" max={thisMonth} value={range.kind === "month" ? range.value : ""}
        onChange={(e) => e.target.value && go({ month: e.target.value })} />
    </div>
  );
}
