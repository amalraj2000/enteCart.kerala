import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { cleanCategoryName, parseId, validateCategoryName } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid category id");
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const name = cleanCategoryName(b.name);
  const err = validateCategoryName(name);
  if (err) return bad(err);
  const c = await db();
  try {
    const r = await c.execute({ sql: "UPDATE categories SET name = ? WHERE id = ?", args: [name, id] });
    if (!r.rowsAffected) return bad("Category not found", 404);
    return NextResponse.json({ ok: true });
  } catch {
    return bad("A category with this name already exists", 409);
  }
}

/** Deleting a category keeps its products — they just become uncategorised. */
export async function DELETE(_: Request, { params }: Ctx) {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  const id = parseId((await params).id);
  if (!id) return bad("Invalid category id");
  const c = await db();
  await c.execute({ sql: "UPDATE products SET category_id = NULL WHERE category_id = ?", args: [id] });
  const r = await c.execute({ sql: "DELETE FROM categories WHERE id = ?", args: [id] });
  if (!r.rowsAffected) return bad("Category not found", 404);
  return NextResponse.json({ ok: true });
}
