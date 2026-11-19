"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toaster";
import Pagination from "@/components/Pagination";
import type { PageInfo } from "@/lib/paginate";
import Req from "@/components/Req";
import FieldError from "@/components/FieldError";
import { CATEGORY_NAME_MAX, cleanCategoryName, validateCategoryName } from "@/lib/validate";
import type { Category } from "@/lib/types";

type Cat = Category & { editable?: boolean; added_by_name?: string | null };

export default function CategoriesManager({ categories, pi }: { categories: Cat[]; pi: PageInfo }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function call(url: string, method: string, body?: unknown) {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, error: (await r.json().catch(() => ({}))).error as string | undefined };
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = cleanCategoryName(name), v = validateCategoryName(n);
    setErr(v);
    if (v) return;
    const r = await call("/api/admin/categories", "POST", { name: n });
    if (!r.ok) return toast.error(r.error || "Could not add category");
    toast.success(`Category "${n}" added`); setName(""); router.refresh();
  }
  async function del(c: Cat) {
    if (!confirm(`Delete "${c.name}"?${c.count ? ` Its ${c.count} product(s) will become uncategorised.` : ""}`)) return;
    const r = await call(`/api/admin/categories/${c.id}`, "DELETE");
    r.ok ? toast.success("Category deleted") : toast.error(r.error || "Could not delete category");
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Categories ({pi.total})</h1>
      <form onSubmit={add} noValidate className="card p-4">
        <label className="mb-1 block text-xs font-semibold text-gray-500">New category<Req /></label>
        <div className="flex gap-2">
          <input className={`input ${err ? "!border-red-500" : ""}`} placeholder="e.g. Sarees" maxLength={CATEGORY_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary shrink-0">+ Add</button>
        </div>
        <FieldError msg={err ?? undefined} />
      </form>

      <div className="card divide-y">
        {categories.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.name}<span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "inactive" ? "bg-gray-200 text-gray-600" : "bg-green-100 text-green-800"}`}>{c.status === "inactive" ? "Inactive" : "Active"}</span></p>
              <p className="text-xs text-gray-500">{c.count} product{c.count === 1 ? "" : "s"} · Added by <span className="font-medium text-gray-600">{c.added_by_name || "—"}</span></p>
            </div>
            {c.editable === false
              ? <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500" title="Created by another admin">View only</span>
              : <>
                  <Link href={`/admin/categories/${c.id}/edit`} className="btn-outline !py-1">Edit</Link>
                  <button className="btn-danger !py-1" onClick={() => del(c)}>Delete</button>
                </>}
          </div>
        ))}
        {!categories.length && <p className="p-6 text-center text-gray-500">No categories yet.</p>}
      </div>
      <Pagination page={pi.page} totalPages={pi.totalPages} total={pi.total} hrefFor={(p) => `/admin/categories${p > 1 ? `?page=${p}` : ""}`} />
    </div>
  );
}
