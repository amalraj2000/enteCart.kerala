/**
 * Shop-front visibility rule. A product is shown to customers only if it is "active" AND its category (if it has one) is "active".
 * Use with:  FROM products p LEFT JOIN categories pc ON pc.id = p.category_id  WHERE ${VISIBLE}
 */
export const VISIBLE = "p.status = 'active' AND (pc.id IS NULL OR pc.status = 'active')";
export const CATEGORY_JOIN = "LEFT JOIN categories pc ON pc.id = p.category_id";
export const STATUSES = ["active", "inactive"] as const;
export type Status = (typeof STATUSES)[number];
export const cleanStatus = (v: unknown): Status => (v === "inactive" ? "inactive" : "active");
