"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "@/components/Toaster";

const LINKS = [
  ["/admin", "Dashboard", "📊"],
  ["/admin/categories", "Categories", "🏷️"],
  ["/admin/products", "Products", "📦"],
  ["/admin/orders", "Orders", "🧾"],
  ["/admin/banners", "Banners", "🖼️"],
  ["/admin/users", "Users", "👥"],
  ["/admin/settings", "Settings", "⚙️"],
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  return (
    <aside className="md:w-56 md:shrink-0">
      <div className="card flex gap-1 overflow-x-auto p-2 md:sticky md:top-24 md:flex-col md:overflow-visible">
        <p className="hidden px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-gray-400 md:block">Admin panel</p>
        {LINKS.map(([href, label, icon]) => {
          const active = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-brand-600 text-white shadow-sm" : "text-gray-700 hover:bg-brand-50"}`}>
              <span>{icon}</span>{label}
            </Link>
          );
        })}
        <button
          className="flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 md:mt-2 md:border-t md:pt-3"
          onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); toast.success("Logged out"); router.replace("/"); router.refresh(); }}>
          <span>🚪</span>Logout
        </button>
      </div>
    </aside>
  );
}
