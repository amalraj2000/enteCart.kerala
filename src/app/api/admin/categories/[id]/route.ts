import { NextResponse } from "next/server";
import { revalidateCatalog } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { canEditRow } from "@/lib/permissions";
import { bad, readJson } from "@/lib/http";
import { cleanCategoryName, parseId, validateCategoryName } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

async function guard(me: { id: number; role: "admin" | "subadmin" }, id: number) {
  const c = await db();
  const row = (await c.execute({ sql: "SELECT created_by FROM categories WHERE id = ?", args: [id] })).rows[0];
  if (!row) return bad("Category not found", 404);
  if (!canEditRow(me, row.created_by)) return bad("You can only change categories you created", 403);
  return null;
}

export async function PUT(req: Request, { params }: Ctx) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid category id");
  const denied = await guard(me, id);
  if (denied) return denied;
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  // Either field may be sent: { name } to rename, { status } to switch active/inactive (or both).
  const hasName = b.name !== undefined, hasStatus = b.status !== undefined;
  if (!hasName && !hasStatus) return bad("Nothing to update");
  if (hasStatus && b.status !== "active" && b.status !== "inactive") return bad("Invalid status");
  const name = hasName ? cleanCategoryName(b.name) : "";
  const err = hasName ? validateCategoryName(name) : null;
  if (err) return bad(err);
  const c = await db();
  // Hiding a category hides every product in it — a sub admin may not do that to products other admins added.
  if (hasStatus && b.status === "inactive" && me.role !== "admin" && (await c.execute({ sql: "SELECT 1 FROM products WHERE category_id = ? AND created_by IS NOT ? LIMIT 1", args: [id, me.id] })).rows.length)
    return bad("Products added by other admins use this category, so it can't be deactivated.", 409);
  try {
    const sets = [...(hasName ? ["name = ?"] : []), ...(hasStatus ? ["status = ?"] : [])];
    const r = await c.execute({ sql: `UPDATE categories SET ${sets.join(", ")} WHERE id = ?`, args: [...(hasName ? [name] : []), ...(hasStatus ? [String(b.status)] : []), id] });
    if (!r.rowsAffected) return bad("Category not found", 404);
    revalidateCatalog();
    return NextResponse.json({ ok: true });
  } catch {
    return bad("A category with this name already exists", 409);
  }
}

/** Deleting a category keeps its products — they just become uncategorised. */
export async function DELETE(_: Request, { params }: Ctx) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid category id");
  const denied = await guard(me, id);
  if (denied) return denied;
  const c = await db();
  // Deleting un-categorises its products — a sub admin may not do that to products other admins added.
  if (me.role !== "admin" && (await c.execute({ sql: "SELECT 1 FROM products WHERE category_id = ? AND created_by IS NOT ? LIMIT 1", args: [id, me.id] })).rows.length)
    return bad("Products added by other admins use this category, so it can't be deleted.", 409);
  await c.execute({ sql: "UPDATE products SET category_id = NULL WHERE category_id = ?", args: [id] });
  const r = await c.execute({ sql: "DELETE FROM categories WHERE id = ?", args: [id] });
  if (!r.rowsAffected) return bad("Category not found", 404);
  revalidateCatalog();
  return NextResponse.json({ ok: true });
}
