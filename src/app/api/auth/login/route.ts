import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { setSession } from "@/lib/session";
import { bad, clientIp, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { isAdminIdentifier, verifyAdmin } from "@/lib/adminAuth";
import { firstError, str, validateAuth } from "@/lib/validate";

// Compared against when the account doesn't exist, so response time doesn't reveal which accounts exist.
const DUMMY_HASH = "$2b$10$Yd4Q4fYuQgBJO7BpJ3/qi.g8H5D2SoOyMUNjXU/jHPOHF17RQj2ua";

export async function POST(req: Request) {
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const err = firstError(validateAuth(b, "login"));
  if (err) return bad(err);
  const id = str(b.identifier).toLowerCase();
  const ip = clientIp(req);
  if (!(await rateLimit(`login-ip:${ip}`, 30, 600)) || !(await rateLimit(`login:${ip}:${id}`, 8, 600)))
    return bad("Too many login attempts. Please wait 10 minutes and try again.", 429);

  // Admin signs in through this same form: if the email is the admin's, check the admin password instead.
  if (await isAdminIdentifier(id)) {
    const ok = await verifyAdmin(id, b.password as string);
    if (ok === null) return bad("Admin credentials are not configured on the server", 500);
    if (!ok) return bad("Invalid phone/email or password", 401);
    await setSession("admin", {});
    return NextResponse.json({ admin: true });
  }

  const c = await db();
  const r = await c.execute({ sql: "SELECT id, identifier, password, status FROM users WHERE identifier = ?", args: [id] });
  const u = r.rows[0];
  const ok = await bcrypt.compare(b.password as string, u ? String(u.password) : DUMMY_HASH);
  if (!u || !ok) return bad("Invalid phone/email or password", 401);
  if (u.status === "blocked") return bad("Your account has been blocked. Please contact support.", 403);
  if (u.status === "inactive") return bad("Your account is inactive. Please contact support.", 403);
  await setSession("user", { uid: Number(u.id), identifier: String(u.identifier) });
  return NextResponse.json({ user: { id: Number(u.id), identifier: String(u.identifier) } });
}
