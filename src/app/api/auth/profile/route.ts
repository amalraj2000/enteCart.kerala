import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { validateAvatar } from "@/lib/validate";

/** Customer profile = picture only. The customer's name is the Full Name on their address (see /api/auth/address). */
export async function PUT(req: Request) {
  const u = await getUser();
  if (!u) return bad("Login required", 401);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const avatar = typeof b.avatar === "string" ? b.avatar : "";
  const err = validateAvatar(avatar);
  if (err) return bad(err);
  const c = await db();
  await c.execute({ sql: "UPDATE users SET avatar = ? WHERE id = ?", args: [avatar, u.id] });
  return NextResponse.json({ ok: true });
}
