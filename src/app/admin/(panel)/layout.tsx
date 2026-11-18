import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/session";
import Sidebar from "./Sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/?login=1");
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
