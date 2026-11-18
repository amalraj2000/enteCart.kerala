import Link from "next/link";
import { PAGE_SIZE } from "@/lib/paginate";

type Props = { page: number; totalPages: number; total: number; hrefFor?: (p: number) => string; onPage?: (p: number) => void };

/** Prev / numbered / Next pager. Pass `hrefFor` for URL-driven pages or `onPage` for client-state pages. */
export default function Pagination({ page, totalPages, total, hrefFor, onPage }: Props) {
  if (total <= PAGE_SIZE) return null;
  const from = (page - 1) * PAGE_SIZE + 1, to = Math.min(page * PAGE_SIZE, total);

  // 1 … 4 5 [6] 7 8 … 20
  const nums: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) nums.push(p); else if (nums[nums.length - 1] !== "…") nums.push("…");

  const base = "flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-medium";
  const cell = (p: number, label: React.ReactNode, cls: string, disabled = false, aria?: string) =>
    disabled ? <span key={aria ?? p} className={`${base} cursor-not-allowed border-gray-200 text-gray-300`} aria-disabled>{label}</span>
    : hrefFor ? <Link key={aria ?? p} href={hrefFor(p)} className={`${base} ${cls}`} aria-label={aria} aria-current={p === page && !aria ? "page" : undefined}>{label}</Link>
    : <button key={aria ?? p} type="button" onClick={() => onPage?.(p)} className={`${base} ${cls}`} aria-label={aria} aria-current={p === page && !aria ? "page" : undefined}>{label}</button>;
  const idle = "border-gray-300 bg-white hover:border-brand-600 hover:text-brand-700";

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-gray-500">Showing {from}–{to} of {total}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {cell(page - 1, "‹ Prev", idle, page <= 1, "Previous page")}
        {nums.map((n, i) => n === "…" ? <span key={`e${i}`} className="px-1 text-gray-400">…</span> : cell(n, n, n === page ? "border-brand-600 bg-brand-600 text-white" : idle))}
        {cell(page + 1, "Next ›", idle, page >= totalPages, "Next page")}
      </div>
    </nav>
  );
}
