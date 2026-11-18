"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "@/components/Toaster";

const LINKS: [string, string, string, boolean?][] = [
  ["/admin", "Dashboard", "📊"],
  ["/admin/categories", "Categories", "🏷️"],
  ["/admin/products", "Products", "📦"],
  ["/admin/orders", "Orders", "🧾"],
  ["/admin/banners", "Banners", "🖼️"],
  ["/admin/users", "Users", "👥"],
  ["/admin/payments", "Payments", "💳", true], // owner-only
  ["/admin/admins", "Admins", "🛡️", true], // owner-only
  ["/admin/settings", "Settings", "⚙️", true], // owner-only
];

export default function Sidebar({ role }: { role: "admin" | "subadmin" }) {
  const path = usePathname();
  const router = useRouter();
  return (
    <aside className="md:w-56 md:shrink-0">
      <div className="card grid grid-cols-3 gap-1 p-2 md:sticky md:top-24 md:flex md:flex-col">
        <p className="hidden px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-gray-400 md:block">{role === "admin" ? "Super admin panel" : "Sub admin panel"}</p>
        {LINKS.filter(([, , , ownerOnly]) => !ownerOnly || role === "admin").map(([href, label, icon]) => {
          const active = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 text-center text-xs font-medium transition md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2 md:text-sm ${active ? "bg-brand-600 text-white shadow-sm" : "text-gray-700 hover:bg-brand-50"}`}>
              <span className="text-lg md:text-base" aria-hidden>{icon}</span>{label}
            </Link>
          );
        })}
        <button
          className="flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2.5 text-center text-xs font-medium text-red-600 hover:bg-red-50 md:mt-2 md:flex-row md:justify-start md:gap-3 md:border-t md:px-3 md:pt-3 md:text-sm"
          onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); toast.success("Logged out"); router.replace("/"); router.refresh(); }}>
          <span className="text-lg md:text-base" aria-hidden>🚪</span>Logout
        </button>
      </div>
    </aside>
  );
}
