import type { Client } from "@libsql/client";
import { ADDRESS_KEYS, type Address } from "./validate";

/** The customer's saved address (users.address_id → addresses), in the shape the forms use. */
export async function getSavedAddress(c: Client, userId: number): Promise<(Address & { id: number }) | null> {
  const r = (await c.execute({
    sql: `SELECT a.id, a.full_name, a.phone, a.house_name, a.street_name, a.city, a.state, a.pincode
          FROM users u JOIN addresses a ON a.id = u.address_id WHERE u.id = ?`,
    args: [userId],
  })).rows[0];
  return r ? { id: Number(r.id), customer_name: String(r.full_name), phone: String(r.phone), house_name: String(r.house_name), street_name: String(r.street_name), city: String(r.city), state: String(r.state), pincode: String(r.pincode) } : null;
}

export const sameAddress = (a: Address, b: Address) => ADDRESS_KEYS.every((k) => a[k].trim().toLowerCase() === b[k].trim().toLowerCase());

/** Creates or updates the user's saved address and keeps users.name equal to the address Full Name. Returns the address id. */
export async function saveAddress(c: Client, userId: number, a: Address): Promise<number> {
  const existing = await getSavedAddress(c, userId);
  let id: number;
  if (existing) {
    id = existing.id;
    await c.execute({ sql: "UPDATE addresses SET full_name=?, phone=?, house_name=?, street_name=?, city=?, state=?, pincode=? WHERE id=?", args: [a.customer_name, a.phone, a.house_name, a.street_name, a.city, a.state, a.pincode, id] });
  } else {
    const r = await c.execute({ sql: "INSERT INTO addresses (user_id, full_name, phone, house_name, street_name, city, state, pincode) VALUES (?,?,?,?,?,?,?,?)", args: [userId, a.customer_name, a.phone, a.house_name, a.street_name, a.city, a.state, a.pincode] });
    id = Number(r.lastInsertRowid);
  }
  await c.execute({ sql: "UPDATE users SET address_id = ?, name = ? WHERE id = ?", args: [id, a.customer_name, userId] });
  return id;
}
