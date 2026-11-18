import { db } from "@/lib/db";
import BannerManager, { type Banner } from "./BannerManager";

export const dynamic = "force-dynamic";

export default async function AdminBanners() {
  const c = await db();
  const rows = (await c.execute("SELECT * FROM banners ORDER BY position, id")).rows;
  return <BannerManager banners={JSON.parse(JSON.stringify(rows)) as Banner[]} />;
}
