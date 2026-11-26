import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/session";
import Sidebar from "./Sidebar";
import { inboxEnabled } from "@/lib/inbox";
import SwitchBack from "./SwitchBack";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getAdmin();
  if (!me) redirect("/?login=1");
  return (
    <div className="admin-shell flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
      <Sidebar role={me.role} inbox={me.role === "admin" && (await inboxEnabled())} />
      <div className="min-w-0 flex-1">
        {me.impersonator && <SwitchBack as={me.vendor_name || me.name || me.identifier} owner={me.impersonator.name} />}
        {children}
      </div>
    </div>
  );
}
