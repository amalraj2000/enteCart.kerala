import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { setSession } from "@/lib/session";
import { bad, clientIp, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { firstError, str, validateAuth } from "@/lib/validate";

export async function POST(req: Request) {
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const err = firstError(validateAuth(b, "register"));
  if (err) return bad(err);
  const id = str(b.identifier).toLowerCase();
  if (!(await rateLimit(`register:${clientIp(req)}`, 10, 3600))) return bad("Too many registrations from this network. Try again later.", 429);

  const c = await db();
  const exists = await c.execute({ sql: "SELECT id FROM users WHERE email = ? OR phone = ?", args: [id, id] });
  if (exists.rows.length) return bad("Account already exists. Please log in.", 409);

  const hash = await bcrypt.hash(b.password as string, 10);
  const isPhone = /^\d{10}$/.test(id); // a 10-digit number is stored as the phone, anything else (a Gmail) as the email
  const r = await c.execute({ sql: "INSERT INTO users (email, phone, password) VALUES (?, ?, ?)", args: [isPhone ? null : id, isPhone ? id : null, hash] });
  await setSession("user", { uid: Number(r.lastInsertRowid), identifier: id });
  return NextResponse.json({ user: { id: Number(r.lastInsertRowid), identifier: id } });
}
