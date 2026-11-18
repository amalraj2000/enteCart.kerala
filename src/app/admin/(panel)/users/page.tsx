import { db } from "@/lib/db";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import UsersTable from "./UsersTable";

export const dynamic = "force-dynamic";

export default async function Users({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const c = await db();
  const total = Number((await c.execute("SELECT COUNT(*) AS n FROM users")).rows[0].n);
  const pi = pageInfo(total, parsePage((await searchParams).page));
  const rows = (await c.execute({ sql: `SELECT id, name, email, phone, status, role, created_at FROM users ORDER BY (role = 'admin') DESC, id DESC LIMIT ${PAGE_SIZE} OFFSET ?`, args: [pi.offset] })).rows;
  return <UsersTable users={JSON.parse(JSON.stringify(rows))} pi={pi} />;
}
