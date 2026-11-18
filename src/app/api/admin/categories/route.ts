import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { cleanCategoryName, validateCategoryName } from "@/lib/validate";

export async function POST(req: Request) {
  const me = await getAdmin();
  if (!me) return bad("Unauthorized", 401);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const name = cleanCategoryName(b.name);
  const err = validateCategoryName(name);
  if (err) return bad(err);
  const c = await db();
  try {
    const r = await c.execute({ sql: "INSERT INTO categories (name, created_by) VALUES (?, ?)", args: [name, me.id] });
    return NextResponse.json({ id: Number(r.lastInsertRowid) });
  } catch {
    return bad("A category with this name already exists", 409);
  }
}
