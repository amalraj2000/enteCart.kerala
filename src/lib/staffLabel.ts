/**
 * SQL snippets that turn a users row (alias `a`) into the text we show.
 *   staff screens  → "Meera Traders (Sub admin)" / "Super admin"
 *   customer pages → the vendor's brand name only ("Meera Traders" / "enteCart.kerala"), never a person's name or email.
 */
export const staffNameSql = (a: string) => `CASE
  WHEN ${a}.role = 'subadmin' THEN COALESCE(NULLIF(${a}.vendor_name, ''), NULLIF(${a}.name, ''), ${a}.email, ${a}.phone) || ' (Sub admin)'
  WHEN ${a}.role = 'admin' THEN CASE WHEN COALESCE(${a}.name, '') IN ('', 'Admin') THEN 'Super admin' ELSE ${a}.name || ' (Super admin)' END
  ELSE COALESCE(NULLIF(${a}.name, ''), ${a}.email, ${a}.phone) END`;

/** For a creator column (products/categories/banners.created_by): NULL if unknown, "Former admin" if that account was deleted. */
export const addedBySql = (createdByCol: string, a: string) =>
  `CASE WHEN ${createdByCol} IS NULL THEN NULL WHEN ${a}.id IS NULL THEN 'Former admin' ELSE ${staffNameSql(a)} END`;

/** What customers see as "Sold by": a sub admin's vendor name, otherwise the shop itself. */
export const vendorSql = (createdByCol: string, a: string) =>
  `CASE WHEN ${createdByCol} IS NULL THEN NULL
        WHEN ${a}.role = 'subadmin' AND COALESCE(${a}.vendor_name, '') != '' THEN ${a}.vendor_name
        ELSE 'enteCart.kerala' END`;

/** The same label in TypeScript, for a row already in memory. */
export function staffName(u: { role?: string; name?: string | null; vendor_name?: string | null; email?: string | null; phone?: string | null }): string {
  if (u.role === "subadmin") return `${u.vendor_name || u.name || u.email || u.phone} (Sub admin)`;
  if (u.role === "admin") return !u.name || u.name === "Admin" ? "Super admin" : `${u.name} (Super admin)`;
  return u.name || u.email || u.phone || "";
}
/** The name to greet someone with: vendor name for sub admins. */
export const welcomeName = (u: { role?: string; name?: string | null; vendor_name?: string | null; email?: string | null }) =>
  u.role === "subadmin" ? u.vendor_name || u.name || u.email || "" : !u.name || u.name === "Admin" ? "Super admin" : u.name;
