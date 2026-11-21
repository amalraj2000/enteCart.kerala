import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { pwTag, setSession } from "@/lib/session";
import { bad, clientIp, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { str, validateIdentifier } from "@/lib/validate";

/**
 * "Continue without a password": the customer types their Gmail / phone and is logged in at once (account created the first time).
 * Because nothing proves who is typing, this is limited on purpose:
 *  • only accounts that have NO password (created this way) can be opened like this — an account with a password always needs it;
 *  • staff accounts, blocked and inactive customers are refused;
 *  • rate-limited per network and per address.
 */
export async function POST(req: Request) {
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const err = validateIdentifier(b.identifier);
  if (err) return bad(err);
  const id = str(b.identifier).toLowerCase();
  const isPhone = /^\d{10}$/.test(id);
  if (!(await rateLimit(`quick-ip:${clientIp(req)}`, 20, 600)) || !(await rateLimit(`quick:${id}`, 10, 600))) return bad("Too many attempts. Please wait a few minutes.", 429);

  const c = await db();
  let u = (await c.execute({ sql: "SELECT id, email, phone, password, status, role, password_set FROM users WHERE email = ? OR phone = ?", args: [id, id] })).rows[0];
  if (u) {
    if (u.role !== "user") return bad("Staff accounts must log in with their email and password.", 403);
    if (u.status === "blocked") return bad("Your account has been blocked. Please contact support.", 403);
    if (u.status === "inactive") return bad("Your account is inactive. Please contact support.", 403);
    if (Number(u.password_set) !== 0) return bad("This account is protected with a password. Please log in with your password.", 403);
  } else {
    const hash = await bcrypt.hash(randomBytes(32).toString("hex"), 10); // nobody knows this password: the account is "no password" (password_set = 0)
    const r = await c.execute({ sql: "INSERT INTO users (email, phone, password, password_set) VALUES (?, ?, ?, 0)", args: [isPhone ? null : id, isPhone ? id : null, hash] });
    u = { id: Number(r.lastInsertRowid), email: isPhone ? null : id, phone: isPhone ? id : null, password: hash, status: "active", role: "user", password_set: 0 } as unknown as typeof u;
  }
  await setSession("user", { uid: Number(u.id), identifier: String(u.email || u.phone), ph: pwTag(String(u.password)) });
  return NextResponse.json({ user: { id: Number(u.id), identifier: String(u.email || u.phone) } });
}
