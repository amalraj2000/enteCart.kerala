import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import { customerNameSql } from "@/lib/userName";
import UsersTable from "./UsersTable";

export const dynamic = "force-dynamic";

export default async function Users({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const me = await requireAdmin();
  const c = await db();
  const total = Number((await c.execute("SELECT COUNT(*) AS n FROM users WHERE role = 'user'")).rows[0].n);
  const pi = pageInfo(total, parsePage((await searchParams).page));
  const rows = (await c.execute({ sql: `SELECT u.id, ${customerNameSql("u")} AS name, u.email, u.phone, u.status, u.role, u.created_at FROM users u WHERE u.role = 'user' ORDER BY u.id DESC LIMIT ${PAGE_SIZE} OFFSET ?`, args: [pi.offset] })).rows;
  return <UsersTable users={JSON.parse(JSON.stringify(rows))} pi={pi} staffRole={me.role} />;
}
