"use client";
import { usePathname } from "next/navigation";

/** Full footer on the shop, slim one on admin pages. */
export default function FooterSwitch({ full, slim }: { full: React.ReactNode; slim: React.ReactNode }) {
  return usePathname().startsWith("/admin") ? <>{slim}</> : <>{full}</>;
}
