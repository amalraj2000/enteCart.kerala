import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/session";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import AdminsManager from "./AdminsManager";

export const dynamic = "force-dynamic";

/** Owner admin only: sub-admins who try the address directly are sent back to the dashboard. */
export default async function AdminsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const me = await getSuperAdmin();
  if (!me) redirect("/admin");
  const c = await db();
  const total = Number((await c.execute("SELECT COUNT(*) AS n FROM users WHERE role IN ('admin', 'subadmin')")).rows[0].n);
  const pi = pageInfo(total, parsePage((await searchParams).page));
  const rows = (await c.execute({
    sql: `SELECT id, name, email, phone, role, status, created_at FROM users WHERE role IN ('admin', 'subadmin') ORDER BY (role = 'admin') DESC, id LIMIT ${PAGE_SIZE} OFFSET ?`,
    args: [pi.offset],
  })).rows;
  return <AdminsManager admins={JSON.parse(JSON.stringify(rows))} pi={pi} meId={me.id} />;
}
