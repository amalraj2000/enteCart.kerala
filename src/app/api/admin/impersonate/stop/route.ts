import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin, pwTag, setSession } from "@/lib/session";
import { bad } from "@/lib/http";

/** Back to the super admin account that started "login as". getAdmin() has already verified that super admin is still valid. */
export async function POST() {
  const a = await getAdmin();
  if (!a?.impersonator) return bad("Not viewing as a sub admin", 400);
  const o = (await (await db()).execute({ sql: "SELECT id, password FROM users WHERE id = ?", args: [a.impersonator.id] })).rows[0];
  if (!o) return bad("Unauthorized", 401);
  await setSession("admin", { uid: Number(o.id), ph: pwTag(String(o.password)) });
  return NextResponse.json({ ok: true });
}
