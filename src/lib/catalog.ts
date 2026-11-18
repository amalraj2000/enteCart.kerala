import { revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { vendorSql } from "@/lib/staffLabel";
import { CATEGORY_JOIN, VISIBLE } from "@/lib/visibility";
import type { Category } from "@/lib/types";
import type { CardProduct } from "@/components/ProductCard";
import type { BannerData } from "@/components/BannerSlider";

/**
 * Shop-front data is cached (shared by every visitor) and refreshed automatically after 60 s, or immediately whenever an admin
 * edits the catalog or a stock-changing order event happens (call revalidateCatalog() there). This turns ~6 database round trips per
 * page view into zero for almost every visitor. Checkout / order APIs never use this cache: stock is always enforced live.
 */
const TAG = "catalog";
export const revalidateCatalog = () => { try { revalidateTag(TAG); } catch { /* outside a request: harmless, the 60 s expiry still applies */ } };

const NEW_DAYS = 14;        // a product is "New" for this many days after being added
const BEST_MIN_UNITS = 3;   // units sold before a product earns the "Best seller" badge
const COLS = "p.id, p.title, p.price, p.original_price, p.stock, p.sizes, p.image_url, p.images, p.category_id, p.created_at"; // cards don't need the (long) description
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const getHomeData = unstable_cache(
  async (q: string, catId: number | null) => {
    const c = await db();
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`; // escape LIKE wildcards
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (q) { where.push("(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')"); args.push(like, like); }
    if (catId) { where.push("p.category_id = ?"); args.push(catId); }
    const filtered = !!q || !!catId;
    const isNewSql = `(p.created_at >= datetime('now', '-${NEW_DAYS} days')) AS is_new`;

    // All independent reads go out together (one round-trip of waiting instead of five in a row).
    const [cats, sold, products, banners, arrivals] = await Promise.all([
      c.execute("SELECT c.id, c.name, COUNT(p.id) AS count FROM categories c JOIN products p ON p.category_id = c.id WHERE c.status = 'active' AND p.status = 'active' GROUP BY c.id ORDER BY c.name"),
      c.execute(`SELECT ${COLS}, SUM(oi.qty) AS units FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id ${CATEGORY_JOIN}
                 WHERE o.status != 'Cancelled' AND ${VISIBLE} GROUP BY p.id ORDER BY units DESC, p.id DESC LIMIT 8`),
      c.execute({ sql: `SELECT ${COLS}, ${isNewSql} FROM products p ${CATEGORY_JOIN} WHERE ${[VISIBLE, ...where].join(" AND ")} ORDER BY p.id DESC`, args }),
      filtered ? Promise.resolve({ rows: [] }) : c.execute("SELECT id, title, subtitle, button_text, link, image FROM banners WHERE active = 1 ORDER BY position, id"),
      filtered ? Promise.resolve({ rows: [] }) : c.execute(`SELECT ${COLS}, ${isNewSql} FROM products p ${CATEGORY_JOIN} WHERE ${VISIBLE} ORDER BY p.created_at DESC, p.id DESC LIMIT 4`),
    ]);

    const soldRows = sold.rows as unknown as (CardProduct & { units: number })[];
    const bestIds = new Set(soldRows.filter((s) => Number(s.units) >= BEST_MIN_UNITS).slice(0, 4).map((s) => Number(s.id)));
    const mark = (p: CardProduct): CardProduct => ({ ...plain(p), best: bestIds.has(Number(p.id)) });
    const prods = products.rows as unknown as CardProduct[];
    const newIds = new Set(prods.filter((p) => p.is_new).map((p) => Number(p.id)));
    return plain({
      cats: cats.rows as unknown as Category[],
      products: prods.map(mark),
      arrivals: (arrivals.rows as unknown as CardProduct[]).map((p) => ({ ...mark(p), is_new: p.is_new })),
      bestRow: soldRows.filter((s) => Number(s.units) > 0).slice(0, 4).map((p) => ({ ...mark(p), is_new: newIds.has(Number(p.id)) ? 1 : 0 })),
      banners: banners.rows as unknown as BannerData[],
    });
  },
  ["home-v1"], { tags: [TAG], revalidate: 60 },
);

export const getProduct = unstable_cache(
  async (id: number) => {
    const c = await db();
    const r = await c.execute({ sql: `SELECT p.*, c.name AS category_name, ${vendorSql("p.created_by", "cu")} AS vendor
            FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN users cu ON cu.id = p.created_by WHERE p.id = ? AND p.status = 'active' AND (c.id IS NULL OR c.status = 'active')`, args: [id] });
    return r.rows[0] ? plain(r.rows[0]) : null;
  },
  ["product-v1"], { tags: [TAG], revalidate: 60 },
);
