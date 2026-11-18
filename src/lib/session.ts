import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!s || s.length < 32)) throw new Error("SESSION_SECRET must be set (32+ chars) in production");
  return new TextEncoder().encode(s || "dev-insecure-secret-change-me-please-32");
};
const USER_COOKIE = "ek_session";
const ADMIN_COOKIE = "ek_admin";

type Role = "user" | "admin";
const name = (r: Role) => (r === "user" ? USER_COOKIE : ADMIN_COOKIE);

export async function setSession(role: Role, payload: Record<string, unknown>) {
  const token = await new SignJWT({ ...payload, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(role === "admin" ? "8h" : "30d")
    .sign(secret());
  (await cookies()).set(name(role), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: role === "admin" ? "strict" : "lax",
    path: "/",
    maxAge: role === "admin" ? 60 * 60 * 8 : 60 * 60 * 24 * 30,
  });
}

export async function getSession(role: Role): Promise<Record<string, any> | null> {
  const t = (await cookies()).get(name(role))?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, secret(), { algorithms: ["HS256"] });
    return payload.role === role ? payload : null;
  } catch {
    return null;
  }
}

export async function clearSession(role: Role) {
  (await cookies()).delete(name(role));
}

/** Returns the logged-in user only while their account still exists and is active. */
export async function getUser() {
  const s = await getSession("user");
  if (!s) return null;
  const c = await db();
  const r = await c.execute({ sql: "SELECT status, role, email, phone FROM users WHERE id = ?", args: [Number(s.uid)] });
  const u = r.rows[0];
  if (!u || u.status !== "active" || u.role !== "user") return null;
  return { id: Number(s.uid), identifier: String(u.email || u.phone || "") };
}
/** Short fingerprint of a password hash, stored inside the admin session token. */
export const pwTag = (hash: string) => hash.slice(-12);

export type StaffRole = "admin" | "subadmin";

/** The logged-in staff member (owner "admin" or "subadmin"): a users row, re-checked in the DB on every request. */
export async function getAdmin() {
  const s = await getSession("admin");
  if (!s?.uid) return null;
  const c = await db();
  const r = await c.execute({ sql: "SELECT id, email, phone, role, password FROM users WHERE id = ? AND role IN ('admin', 'subadmin') AND status = 'active'", args: [Number(s.uid)] });
  const u = r.rows[0];
  // The session is tied to the current password: resetting it (by the owner, or by the person themself) ends every older session.
  if (u && s.ph !== pwTag(String(u.password))) return null;
  return u ? { id: Number(u.id), identifier: String(u.email || u.phone || ""), role: String(u.role) as StaffRole } : null;
}
/** Any staff member (admin or sub-admin) — guards the whole admin area. */
export const isAdmin = async () => !!(await getAdmin());
/** Only the owner admin — guards the Admins menu and its API (sub-admins are refused). */
export async function getSuperAdmin() {
  const a = await getAdmin();
  return a && a.role === "admin" ? a : null;
}
