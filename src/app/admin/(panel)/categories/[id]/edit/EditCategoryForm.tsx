"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toaster";
import Req from "@/components/Req";
import FieldError from "@/components/FieldError";
import { CATEGORY_NAME_MAX, cleanCategoryName, validateCategoryName } from "@/lib/validate";

export default function EditCategoryForm({ category }: { category: { id: number; name: string; status: string; count: number } }) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [status, setStatus] = useState(category.status);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = cleanCategoryName(name), v = validateCategoryName(n);
    setErr(v);
    if (v) return;
    setBusy(true);
    const r = await fetch(`/api/admin/categories/${category.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n, status }) });
    setBusy(false);
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || "Could not save");
    toast.success("Category updated");
    router.push("/admin/categories"); router.refresh();
  }

  return (
    <form onSubmit={save} noValidate className="card max-w-lg space-y-4 p-5">
      <div><h1 className="text-xl font-bold">Edit category</h1><p className="text-sm text-gray-500">{category.count} product{category.count === 1 ? "" : "s"} in this category</p></div>
      <label className="block text-sm font-medium">Category name<Req />
        <input className={`input mt-1 ${err ? "!border-red-500" : ""}`} maxLength={CATEGORY_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <FieldError msg={err ?? undefined} />
      </label>
      <label className="block text-sm font-medium">Status
        <select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active — visible to customers</option>
          <option value="inactive">Inactive — hidden, along with its products</option>
        </select>
      </label>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        <Link href="/admin/categories" className="btn border">Cancel</Link>
      </div>
    </form>
  );
}
