import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { db } from "./db";

const same = (x: string, y: string) => {
  const a = Buffer.from(x), b = Buffer.from(y);
  return a.length === b.length && timingSafeEqual(a, b);
};

const envEmail = () => (process.env.ADMIN_EMAIL || process.env.ADMIN_USERNAME || "").trim();

/** Credentials saved from the admin profile (DB) override the env-var defaults. `username` is the admin's email. */
export async function verifyAdmin(username: string, password: string): Promise<boolean | null> {
  username = username.trim().toLowerCase();
  const c = await db();
  const row = (await c.execute("SELECT username, password FROM admin WHERE id = 1")).rows[0];
  if (row) {
    const okUser = same(username, String(row.username).trim().toLowerCase());
    const okPass = await bcrypt.compare(password, String(row.password));
    return okUser && okPass;
  }
  const u = envEmail().toLowerCase(), p = process.env.ADMIN_PASSWORD;
  if (!u || !p) return null; // not configured
  const okUser = same(username, u);
  const okPass = same(password, p);
  return okUser && okPass;
}

export async function currentAdminUsername(): Promise<string> {
  const c = await db();
  const row = (await c.execute("SELECT username FROM admin WHERE id = 1")).rows[0];
  return row ? String(row.username) : envEmail();
}

/** Makes sure the admin row exists (seeded from env defaults) so profile data can be saved. */
export async function ensureAdminRow() {
  const c = await db();
  const row = (await c.execute("SELECT id FROM admin WHERE id = 1")).rows[0];
  if (!row) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "", 10);
    await c.execute({ sql: "INSERT INTO admin (id, username, password) VALUES (1, ?, ?)", args: [envEmail() || "admin", hash] });
  }
  return c;
}

/** True when this login identifier is the admin's email. */
export async function isAdminIdentifier(identifier: string): Promise<boolean> {
  const a = (await currentAdminUsername()).trim().toLowerCase();
  return !!a && a === identifier.trim().toLowerCase();
}
