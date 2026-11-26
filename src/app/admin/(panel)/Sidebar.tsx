"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "@/components/Toaster";

const LINKS: [string, string, string, boolean?, boolean?][] = [
  ["/admin", "Dashboard", "📊"],
  ["/admin/categories", "Categories", "🏷️"],
  ["/admin/products", "Products", "📦"],
  ["/admin/orders", "Orders", "🧾"],
  ["/admin/inbox-orders", "Inbox Orders", "📥", true, true], // owner-only, switchable in Settings
  ["/admin/reviews", "Reviews", "⭐"],
  ["/admin/banners", "Banners", "🖼️"],
  ["/admin/users", "Users", "👥"],
  ["/admin/payments", "Payments", "💳", true], // owner-only
  ["/admin/admins", "Admins", "🛡️", true], // owner-only
  ["/admin/settings", "Settings", "⚙️", true], // owner-only
];

export default function Sidebar({ role, inbox }: { role: "admin" | "subadmin"; inbox: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => { bar.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ block: "nearest", inline: "center" }); }, [path]); // phones: keep the open page's tab visible
  return (
    <aside className="md:w-56 md:shrink-0">
      <div ref={bar} className="card flex gap-1 overflow-x-auto p-2 [scrollbar-width:none] md:sticky md:top-24 md:flex-col md:overflow-visible">
        <p className="hidden px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-gray-400 md:block">{role === "admin" ? "Super admin panel" : "Sub admin panel"}</p>
        {LINKS.filter(([, , , ownerOnly, switchable]) => (!ownerOnly || role === "admin") && (!switchable || inbox)).map(([href, label, icon]) => {
          const active = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={`flex min-w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-center text-xs font-medium transition md:min-w-0 md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2 md:text-sm ${active ? "bg-brand-600 text-white shadow-sm" : "text-gray-700 hover:bg-brand-50"}`}>
              <span className="text-lg md:text-base" aria-hidden>{icon}</span>{label}
            </Link>
          );
        })}
        <button
          className="flex min-w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-center text-xs font-medium text-red-600 hover:bg-red-50 md:mt-2 md:flex-row md:justify-start md:gap-3 md:border-t md:px-3 md:pt-3 md:text-sm"
          onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); toast.success("Logged out"); router.replace("/"); router.refresh(); }}>
          <span className="text-lg md:text-base" aria-hidden>🚪</span>Logout
        </button>
      </div>
    </aside>
  );
}
