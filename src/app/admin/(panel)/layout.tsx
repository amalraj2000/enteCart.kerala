import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/session";
import Sidebar from "./Sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getAdmin();
  if (!me) redirect("/?login=1");
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
      <Sidebar role={me.role} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
