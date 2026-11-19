import { revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/lib/db";
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

let lastSoon = 0;
/** For customer-driven stock changes (orders/cancels). During a rush, purging the cache on every order would send every visitor
 *  back to the database, so it is done at most once every 5 s per instance (the 60 s expiry covers the rest; checkout always checks live stock). */
export const revalidateCatalogSoon = () => { if (Date.now() - lastSoon >= 5000) { lastSoon = Date.now(); revalidateCatalog(); } };

const NEW_DAYS = 14;        // a product is "New" for this many days after being added
const BEST_MIN_UNITS = 3;   // units sold before a product earns the "Best seller" badge
const COLS = "p.id, p.public_id, p.title, p.price, p.original_price, p.stock, p.sizes, p.image_url, p.images, p.category_id, p.created_at"; // cards don't need the (long) description
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
    const [cats, sold, products, banners, arrivals, sw] = await Promise.all([
      c.execute("SELECT c.id, c.name, COUNT(p.id) AS count FROM categories c JOIN products p ON p.category_id = c.id WHERE c.status = 'active' AND p.status = 'active' GROUP BY c.id ORDER BY c.name"),
      c.execute(`SELECT ${COLS}, SUM(oi.qty) AS units FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id ${CATEGORY_JOIN}
                 WHERE o.status != 'Cancelled' AND ${VISIBLE} GROUP BY p.id ORDER BY units DESC, p.id DESC LIMIT 8`),
      c.execute({ sql: `SELECT ${COLS}, ${isNewSql} FROM products p ${CATEGORY_JOIN} WHERE ${[VISIBLE, ...where].join(" AND ")} ORDER BY p.id DESC`, args }),
      filtered ? Promise.resolve({ rows: [] }) : c.execute("SELECT id, title, subtitle, button_text, link, image FROM banners WHERE active = 1 ORDER BY position, id"),
      filtered ? Promise.resolve({ rows: [] }) : c.execute(`SELECT ${COLS}, ${isNewSql} FROM products p ${CATEGORY_JOIN} WHERE ${VISIBLE} ORDER BY p.created_at DESC, p.id DESC LIMIT 4`),
      c.execute("SELECT key, value FROM settings WHERE key IN ('show_new_arrivals', 'show_best_sellers')"),
    ]);
    const off = new Set(sw.rows.filter((r) => String(r.value) === "0").map((r) => String(r.key))); // missing = on

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
      showArrivals: !off.has("show_new_arrivals"),
      showBest: !off.has("show_best_sellers"),
    });
  },
  ["home-v1"], { tags: [TAG], revalidate: 60 },
);

export const getProduct = unstable_cache(
  async (publicId: string) => {
    const c = await db();
    const r = await c.execute({ sql: `SELECT p.*, c.name AS category_name
            FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.public_id = ? AND p.status = 'active' AND (c.id IS NULL OR c.status = 'active')`, args: [publicId] });
    return r.rows[0] ? plain(r.rows[0]) : null;
  },
  ["product-v3"], { tags: [TAG], revalidate: 60 },
);

/** Old links (/product/12) → the product's new public id, so shared / indexed / bookmarked links keep working. null = not visible. */
export const publicIdForLegacyId = unstable_cache(
  async (id: number) => {
    const c = await db();
    const r = await c.execute({ sql: `SELECT p.public_id FROM products p ${CATEGORY_JOIN} WHERE p.id = ? AND ${VISIBLE}`, args: [id] });
    return r.rows[0]?.public_id ? String(r.rows[0].public_id) : null;
  },
  ["product-legacy-v1"], { tags: [TAG], revalidate: 60 },
);

