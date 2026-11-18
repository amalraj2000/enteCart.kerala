import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isAdmin } from "@/lib/session";
import { currentAdminUsername, ensureAdminRow, verifyAdmin } from "@/lib/adminAuth";
import { bad, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { firstError, validatePasswordChange } from "@/lib/validate";

export async function PUT(req: Request) {
  if (!(await isAdmin())) return bad("Unauthorized", 401);
  if (!(await rateLimit("admin-pw", 5, 600))) return bad("Too many attempts. Try again in a few minutes.", 429);
  const b = await readJson(req);
  if (!b) return bad("Invalid request");
  const err = firstError(validatePasswordChange(b));
  if (err) return bad(err);
  if (!(await verifyAdmin(await currentAdminUsername(), b.currentPassword as string))) return bad("Current password is incorrect", 403);
  const c = await ensureAdminRow();
  await c.execute({ sql: "UPDATE admin SET password = ? WHERE id = 1", args: [await bcrypt.hash(b.newPassword as string, 10)] });
  return NextResponse.json({ ok: true });
}
