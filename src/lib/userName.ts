/**
 * SQL for a customer's display name (users row aliased `u`): the profile name if they have one,
 * otherwise the Full Name on their saved address, otherwise the name on their address in any other
 * saved address, otherwise the name they gave on their latest order. Empty string if none.
 */
export const customerNameSql = (u = "u") => `COALESCE(
  NULLIF(${u}.name, ''),
  (SELECT NULLIF(a.full_name, '') FROM addresses a WHERE a.id = ${u}.address_id),
  (SELECT NULLIF(a.full_name, '') FROM addresses a WHERE a.user_id = ${u}.id ORDER BY a.id DESC LIMIT 1),
  (SELECT NULLIF(o.customer_name, '') FROM orders o WHERE o.user_id = ${u}.id ORDER BY o.id DESC LIMIT 1),
  '')`;
