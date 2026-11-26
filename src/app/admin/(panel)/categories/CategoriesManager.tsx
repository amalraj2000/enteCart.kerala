"use client";
import SearchBox from "@/components/SearchBox";
import IconBtn from "@/components/IconBtn";
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

export default function CategoriesManager({ categories, pi, q = "" }: { categories: Cat[]; pi: PageInfo; q?: string }) {
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
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Categories ({pi.total})</h1>
      <SearchBox path="/admin/categories" q={q} placeholder="Search categories by name" />
      <form onSubmit={add} noValidate className="card p-4">
        <label className="mb-1 block text-xs font-semibold text-gray-500">New category<Req /></label>
        <div className="flex gap-2">
          <input className={`input ${err ? "!border-red-500" : ""}`} placeholder="e.g. Sarees" maxLength={CATEGORY_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary shrink-0">+ Add</button>
        </div>
        <FieldError msg={err ?? undefined} />
      </form>

      <div className="card overflow-x-auto">
        <table className="rtable w-full min-w-[520px] text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr><th className="p-3">Category</th><th className="p-3">Status</th><th className="p-3">Products</th><th className="p-3">Added by</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y">
            {categories.map((c) => (
              <tr key={c.id} className="align-middle">
                <td data-label="Category" className="p-3 font-medium">{c.name}</td>
                <td data-label="Status" className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.status === "inactive" ? "bg-gray-200 text-gray-600" : "bg-green-100 text-green-800"}`}>{c.status === "inactive" ? "Inactive" : "Active"}</span></td>
                <td data-label="Products" className="p-3">{c.count}</td>
                <td data-label="Added by" className="p-3 text-gray-600">{c.added_by_name || "—"}</td>
                <td data-label="Actions" className="p-3">
                  <div className="flex justify-end gap-1.5">
                    {c.editable === false
                      ? <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500" title="Created by another admin">View only</span>
                      : <>
                          <IconBtn kind="edit" label={`Edit ${c.name}`} href={`/admin/categories/${c.id}/edit`} />
                          <IconBtn kind="delete" label={`Delete ${c.name}`} onClick={() => del(c)} />
                        </>}
                  </div>
                </td>
              </tr>
            ))}
            {!categories.length && <tr><td colSpan={5} className="p-6 text-center text-gray-500">{q ? `No categories match “${q}”.` : "No categories yet."}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={pi.page} totalPages={pi.totalPages} total={pi.total} hrefFor={(p) => `/admin/categories?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`} />
    </div>
  );
}
