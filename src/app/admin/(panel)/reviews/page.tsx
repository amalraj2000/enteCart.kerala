import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PAGE_SIZE, pageInfo, parsePage } from "@/lib/paginate";
import { customerNameSql } from "@/lib/userName";
import { reviewsEnabled, withPhotos } from "@/lib/reviews";
import ReviewsManager, { type AdminReview } from "./ReviewsManager";

export const dynamic = "force-dynamic";
const FILTERS = ["All", "Pending", "Approved", "Rejected", "Inactive"] as const;

/** Review moderation. Super admin: every review + the master on/off switch. Sub admin: only reviews of products they added. */
export default async function Reviews({ searchParams }: { searchParams: Promise<{ page?: string; f?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const f = FILTERS.find((x) => x === sp.f) ?? "All";
  const c = await db();
  const own: string[] = [], ownArgs: (string | number)[] = [];
  if (me.role !== "admin") { own.push("p.created_by = ?"); ownArgs.push(me.id); } // sub admins: their own products only
  const conds = [...own], args = [...ownArgs];
  if (f === "Inactive") conds.push("r.active = 0");
  else if (f !== "All") { conds.push("r.status = ?"); args.push(f.toLowerCase()); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const from = "FROM reviews r LEFT JOIN products p ON p.id = r.product_id JOIN users u ON u.id = r.user_id";
  const total = Number((await c.execute({ sql: `SELECT COUNT(*) AS n ${from} ${where}`, args })).rows[0].n);
  const cw = own.length ? `WHERE ${own.join(" AND ")}` : "";
  const cr = (await c.execute({ sql: `SELECT COUNT(*) AS n, SUM(r.status = 'pending') AS pending, SUM(r.status = 'approved') AS approved, SUM(r.status = 'rejected') AS rejected, SUM(r.active = 0) AS inactive ${from} ${cw}`, args: ownArgs })).rows[0];
  const counts = { All: Number(cr.n), Pending: Number(cr.pending ?? 0), Approved: Number(cr.approved ?? 0), Rejected: Number(cr.rejected ?? 0), Inactive: Number(cr.inactive ?? 0) };
  const pi = pageInfo(total, parsePage(sp.page));
  const rows = (await c.execute({
    sql: `SELECT r.id, r.rating, r.comment, r.status, r.active, r.created_at, p.title AS product_title, p.image_url AS product_image,
                 ${customerNameSql("u")} AS user_name, u.email AS user_email, u.phone AS user_phone
          ${from} ${where} ORDER BY (r.status = 'pending') DESC, r.id DESC LIMIT ${PAGE_SIZE} OFFSET ?`,
    args: [...args, pi.offset],
  })).rows.map((r) => ({ id: Number(r.id), rating: Number(r.rating), comment: String(r.comment), status: String(r.status), active: Number(r.active) === 1, created_at: String(r.created_at),
    product_title: r.product_title ? String(r.product_title) : "(deleted product)", product_image: String(r.product_image || ""),
    user_name: String(r.user_name || "Customer"), email: r.user_email ? String(r.user_email) : "", phone: r.user_phone ? String(r.user_phone) : "" }));
  const reviews = (await withPhotos(c, rows)) as AdminReview[];
  return <ReviewsManager reviews={reviews} pi={pi} filter={f} filters={[...FILTERS]} counts={counts} enabled={await reviewsEnabled(c)} isOwner={me.role === "admin"} />;
}
