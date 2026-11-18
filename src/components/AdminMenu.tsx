"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "./Toaster";

export default function AdminMenu() {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [me, setMe] = useState({ username: "admin", name: "", vendor_name: "", avatar: "", role: "admin" });

  const load = useCallback(() => {
    fetch("/api/admin/profile").then((r) => r.json()).then((d) => d.username && setMe(d));
  }, []);
  useEffect(() => {
    load();
    window.addEventListener("admin-profile-updated", load);
    return () => window.removeEventListener("admin-profile-updated", load);
  }, [load]);

  const name = me.role === "subadmin" ? me.vendor_name || me.name?.split(" ")[0] || me.username : me.name && me.name !== "Admin" ? me.name.split(" ")[0] : "Super admin";
  return (
    <div className="relative">
      <button onClick={() => setMenu(!menu)} className="flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 py-1 pl-1 pr-3 text-sm font-semibold text-brand-700 hover:bg-brand-100" aria-label="Admin account">
        {me.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white">{name[0]?.toUpperCase()}</span>
        )}
        <span className="hidden sm:inline">{name}</span>
        {me.role === "subadmin" && <span className="hidden rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 sm:inline">Sub admin</span>}
      </button>
      {menu && (
        <div className="card absolute right-0 mt-2 w-48 p-1 text-sm" onClick={() => setMenu(false)}>
          <Link href="/admin/account" className="block rounded px-3 py-2 hover:bg-brand-50">⚙️ Account settings</Link>
          <button className="block w-full rounded px-3 py-2 text-left text-red-600 hover:bg-red-50" onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); toast.success("Logged out"); router.replace("/"); router.refresh(); }}>🚪 Logout</button>
        </div>
      )}
    </div>
  );
}
