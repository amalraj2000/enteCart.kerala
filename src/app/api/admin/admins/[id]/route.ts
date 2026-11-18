import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSuperAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { parseId, str, validatePassword, validateStatus, validateVendorName } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Loads the target and makes sure it's a sub admin — the owner account can't be touched from here. */
async function target(id: number) {
  const c = await db();
  const row = (await c.execute({ sql: "SELECT id, role FROM users WHERE id = ?", args: [id] })).rows[0];
  if (!row) return { err: bad("Admin not found", 404) };
  if (row.role !== "subadmin") return { err: bad("Only sub admin accounts can be changed here", 403) };
  return { c };
}

/** PATCH { status } → activate / deactivate / block.   PATCH { password } → reset their password. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await getSuperAdmin())) return bad("Only the super admin can manage admins", 403);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid id");
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const t = await target(id);
  if (t.err) return t.err;

  if ("status" in b) {
    if (!validateStatus(b.status, ["active", "inactive", "blocked"])) return bad("Invalid status");
    await t.c!.execute({ sql: "UPDATE users SET status = ? WHERE id = ? AND role = 'subadmin'", args: [b.status as string, id] });
    return NextResponse.json({ ok: true });
  }
  if ("vendor_name" in b) {
    const vn = str(b.vendor_name).replace(/\s+/g, " "), e = validateVendorName(vn);
    if (e) return bad(e);
    await t.c!.execute({ sql: "UPDATE users SET vendor_name = ? WHERE id = ? AND role = 'subadmin'", args: [vn, id] });
    return NextResponse.json({ ok: true });
  }
  if ("password" in b) {
    const e = validatePassword(b.password, "Password");
    if (e) return bad(e);
    await t.c!.execute({ sql: "UPDATE users SET password = ? WHERE id = ? AND role = 'subadmin'", args: [await bcrypt.hash(b.password as string, 10), id] });
    return NextResponse.json({ ok: true });
  }
  return bad("Nothing to update");
}

export async function DELETE(_: Request, { params }: Ctx) {
  if (!(await getSuperAdmin())) return bad("Only the super admin can manage admins", 403);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid id");
  const t = await target(id);
  if (t.err) return t.err;
  await t.c!.execute({ sql: "DELETE FROM users WHERE id = ? AND role = 'subadmin'", args: [id] });
  return NextResponse.json({ ok: true });
}
