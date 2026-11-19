import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { canEditRow } from "@/lib/permissions";
import { addedBySql } from "@/lib/staffLabel";
import BannerManager, { type Banner } from "./BannerManager";

export const dynamic = "force-dynamic";

export default async function AdminBanners() {
  const me = await requireAdmin();
  const c = await db();
  const rows = (await c.execute(`SELECT b.*, ${addedBySql("b.created_by", "cu")} AS added_by_name
                                 FROM banners b LEFT JOIN users cu ON cu.id = b.created_by ORDER BY b.position, b.id`)).rows;
  const withPerm = rows.map((r) => ({ ...JSON.parse(JSON.stringify(r)), editable: canEditRow(me, r.created_by) })) as Banner[]; // sub admins change only their own
  return <BannerManager banners={withPerm} isOwner={me.role === "admin"} />;
}
