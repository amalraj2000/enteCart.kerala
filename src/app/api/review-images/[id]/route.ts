import { db } from "@/lib/db";
import { getAdmin, getUser } from "@/lib/session";
import { parseId } from "@/lib/validate";

/**
 * Serves a review photo. Public ONLY once its review is Approved; before that (pending / rejected / not yet submitted)
 * only the customer who uploaded it and staff can see it — nobody can browse other people's unreviewed uploads by guessing ids.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return new Response("Not found", { status: 404 });
  const c = await db();
  const row = (await c.execute({ sql: "SELECT i.data, i.user_id, r.status, r.active FROM review_images i LEFT JOIN reviews r ON r.id = i.review_id WHERE i.id = ?", args: [id] })).rows[0];
  const m = row && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(row.data));
  if (!m) return new Response("Not found", { status: 404 });
  const approved = row.status === "approved" && Number(row.active) === 1; // hidden (inactive) reviews keep their photos private too
  if (!approved) {
    const [u, a] = await Promise.all([getUser(), getAdmin()]);
    if (!a && !(u && u.id === Number(row.user_id))) return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(Buffer.from(m[2], "base64")), {
    headers: { "Content-Type": m[1], "X-Content-Type-Options": "nosniff", "Cache-Control": approved ? "public, max-age=3600" : "private, no-store" },
  });
}
