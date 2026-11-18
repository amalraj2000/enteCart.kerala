import { createClient, type Client } from "@libsql/client";
import bcrypt from "bcryptjs";

let client: Client | null = null;
let ready: Promise<void> | null = null;

function getClient(): Client {
  if (!client) {
    if (process.env.NODE_ENV === "production" && !process.env.TURSO_DATABASE_URL)
      throw new Error("TURSO_DATABASE_URL is not set. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in your hosting environment variables.");
    client = createClient({
      // Falls back to a local file ONLY for local development.
      url: process.env.TURSO_DATABASE_URL || "file:local.db",
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
  }
  return client;
}

/*
 * Relational layout
 *   users        id · name · email · phone · password · role · status · avatar · address_id → addresses.id
 *   addresses    id · user_id → users.id · full_name · phone · house_name · street_name · city · state · pincode
 *   orders       id · user_id → users.id · address_id → addresses.id · (shipping snapshot) · total · status
 *   order_items  id · order_id → orders.id · product_id → products.id · title · size · qty · price · image_url
 * Orders keep a snapshot of the shipping address and of each item's title/price, so history stays correct
 * even if the customer edits their address or the product is changed or deleted later.
 */
const USERS_DDL = (name = "users") => `CREATE TABLE ${name} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    avatar TEXT NOT NULL DEFAULT '',
    address_id INTEGER, -- → addresses.id (the saved address). Kept in step by the app: addresses is created after users, so no DB-level FK here.
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`;
const ADDRESSES_DDL = `CREATE TABLE addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    house_name TEXT NOT NULL,
    street_name TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`;
const ORDERS_DDL = (name = "orders") => `CREATE TABLE ${name} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    address_id INTEGER, -- → addresses.id (the saved address). Kept in step by the app: addresses is created after users, so no DB-level FK here.
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    house_name TEXT NOT NULL,
    street_name TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Placed',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`;
const ORDER_ITEMS_DDL = `CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    size TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL,
    price REAL NOT NULL,
    image_url TEXT NOT NULL DEFAULT ''
  )`;
const INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)",
  "CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id)",
];

const IF_NOT_EXISTS = (ddl: string) => ddl.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ");

const BASE_SCHEMA = [
  IF_NOT_EXISTS(USERS_DDL()),
  IF_NOT_EXISTS(ADDRESSES_DDL),
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    sizes TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    images TEXT NOT NULL DEFAULT '',
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  IF_NOT_EXISTS(ORDERS_DDL()),
  IF_NOT_EXISTS(ORDER_ITEMS_DDL),
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
  )`,
  `CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS banners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    button_text TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS wishlist (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, product_id)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  )`,
  // Only read when upgrading a very old database that kept the admin in its own table.
  `CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT ''
  )`,
];

const SEED_CATEGORIES = ["Sarees", "Men's Wear", "Women's Wear", "Groceries", "Home & Kitchen"];

const SEED = [
  ["Kasavu Cotton Saree", "Traditional Kerala kasavu saree with golden zari border. Soft handloom cotton.", 1299, 25, "Free Size", "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800", "Sarees"],
  ["Men's Mundu (Veshti)", "Pure cotton double mundu with kara border. Perfect for festivals.", 799, 40, "2.0m,2.5m", "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800", "Men's Wear"],
  ["Coconut Oil Cold Pressed 1L", "Pure virgin cold-pressed coconut oil from Kerala farms.", 399, 100, "500ml,1L", "https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=800", "Groceries"],
  ["Cotton Kurta", "Breathable everyday cotton kurta.", 599, 30, "S,M,L,XL", "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800", "Men's Wear"],
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function columns(c: Client, table: string): Promise<string[]> {
  return (await c.execute(`PRAGMA table_info(${table})`)).rows.map((r) => String(r.name));
}

/**
 * One-time upgrade of an older database (users.identifier + JSON address + orders.items JSON)
 * to the relational layout above. Runs in ONE transaction, so it either fully applies or not at all,
 * and a claim row in `meta` stops concurrent cold-starts from running it twice.
 */
async function migrateToRelational(c: Client) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const cols = await columns(c, "users");
    if (cols.length === 0 || !cols.includes("identifier")) return; // fresh DB, or already migrated

    const now = Math.floor(Date.now() / 1000);
    const claim = await c.execute({ sql: "INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_v2', ?)", args: [String(now)] });
    if (claim.rowsAffected === 0) {
      const held = Number((await c.execute("SELECT value FROM meta WHERE key = 'schema_v2'")).rows[0]?.value || 0);
      if (now - held > 120) await c.execute("DELETE FROM meta WHERE key = 'schema_v2'"); // stale claim: previous run died
      else await sleep(500); // another instance is migrating — wait for it
      continue;
    }

    try {
      // Make sure every legacy column the copy reads exists (older databases were upgraded by ALTERs).
      for (const [col, def] of [["status", "'active'"], ["role", "'user'"], ["first_name", "''"], ["last_name", "''"], ["avatar", "''"], ["address", "''"]] as const)
        if (!cols.includes(col)) await c.execute(`ALTER TABLE users ADD COLUMN ${col} TEXT NOT NULL DEFAULT ${def}`);

      const oCols = await columns(c, "orders");
      const hasUserId = oCols.includes("user_id");
      const hasTotal = oCols.includes("total");

      await c.batch(
        [
          // 1. stash the JSON blobs that are about to be split into rows
          "CREATE TABLE mig_addr AS SELECT id AS user_id, address FROM users WHERE address != '' AND json_valid(address)",
          "CREATE TABLE mig_items AS SELECT id AS order_id, items FROM orders WHERE json_valid(items)",
          // 2. users
          USERS_DDL("users_new"),
          `INSERT INTO users_new (id, name, email, phone, password, role, status, avatar, created_at)
             SELECT id, trim(first_name || ' ' || last_name),
                    CASE WHEN instr(identifier, '@') > 0 THEN identifier END,
                    CASE WHEN instr(identifier, '@') = 0 THEN identifier END,
                    password, role, status, avatar, created_at FROM users`,
          "DROP TABLE users",
          "ALTER TABLE users_new RENAME TO users",
          // 3. addresses (one per user who had saved an address) + users.address_id
          ADDRESSES_DDL,
          `INSERT INTO addresses (user_id, full_name, phone, house_name, street_name, city, state, pincode)
             SELECT user_id, json_extract(address, '$.customer_name'), json_extract(address, '$.phone'), json_extract(address, '$.house_name'),
                    json_extract(address, '$.street_name'), json_extract(address, '$.city'), json_extract(address, '$.state'), json_extract(address, '$.pincode')
             FROM mig_addr WHERE user_id IN (SELECT id FROM users) AND json_extract(address, '$.customer_name') IS NOT NULL`,
          "UPDATE users SET address_id = (SELECT MIN(a.id) FROM addresses a WHERE a.user_id = users.id)",
          // 4. orders (shipping snapshot stays on the order)
          ORDERS_DDL("orders_new"),
          `INSERT INTO orders_new (id, user_id, customer_name, phone, house_name, street_name, city, state, pincode, total, status, created_at)
             SELECT id, ${hasUserId ? "CASE WHEN user_id IN (SELECT id FROM users) THEN user_id END" : "NULL"},
                    customer_name, phone, house_name, street_name, city, state, pincode, ${hasTotal ? "total" : "0"}, status, created_at FROM orders`,
          "DROP TABLE orders",
          "ALTER TABLE orders_new RENAME TO orders",
          // 5. order_items: one row per product line
          ORDER_ITEMS_DDL,
          `INSERT INTO order_items (order_id, product_id, title, size, qty, price, image_url)
             SELECT s.order_id,
                    CASE WHEN json_extract(j.value, '$.id') IN (SELECT id FROM products) THEN json_extract(j.value, '$.id') END,
                    COALESCE(json_extract(j.value, '$.title'), 'Product'), COALESCE(json_extract(j.value, '$.size'), ''),
                    COALESCE(json_extract(j.value, '$.qty'), 1), COALESCE(json_extract(j.value, '$.price'), 0), COALESCE(json_extract(j.value, '$.image_url'), '')
             FROM mig_items s, json_each(s.items) j`,
          // 6. back-fill missing order totals from their items (very old rows had none), clean up
          `UPDATE orders SET total = (SELECT COALESCE(SUM(qty * price), 0) FROM order_items WHERE order_id = orders.id) WHERE total = 0`,
          "DROP TABLE mig_addr",
          "DROP TABLE mig_items",
        ],
        "write"
      );
      await c.execute("UPDATE meta SET value = 'done' WHERE key = 'schema_v2'");
      return;
    } catch (e) {
      await c.execute("DELETE FROM meta WHERE key = 'schema_v2'").catch(() => {}); // transaction rolled back; let a retry happen
      throw e;
    }
  }
  throw new Error("Database upgrade is taking too long — please retry in a minute.");
}

/** Creates tables (idempotent), upgrades older databases, creates the admin and seeds sample data once. */
export function db(): Promise<Client> {
  if (!ready) {
    const c = getClient();
    ready = (async () => {
      await c.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
      await migrateToRelational(c);
      await c.batch([...BASE_SCHEMA, ...INDEXES].map((sql) => ({ sql, args: [] })), "write");
      // Columns added to products after the first release (databases created before then).
      await c.execute("ALTER TABLE products ADD COLUMN category_id INTEGER").catch(() => {}); // already exists
      await c.execute("ALTER TABLE products ADD COLUMN images TEXT NOT NULL DEFAULT ''").catch(() => {}); // already exists
      await c.execute("ALTER TABLE products ADD COLUMN created_at TEXT").catch(() => {}); // already exists (SQLite can't add a non-constant default)
      await c.execute("UPDATE products SET created_at = datetime('now') WHERE created_at IS NULL"); // existing products count as "added today" once

      // The admin is a normal row in `users` with role = 'admin'. Create it once if none exists:
      // from the old `admin` table if this DB has one, otherwise from ADMIN_EMAIL / ADMIN_PASSWORD.
      const admins = Number((await c.execute("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'")).rows[0].n);
      if (admins === 0) {
        const old = (await c.execute("SELECT username, password, first_name, last_name, avatar FROM admin WHERE id = 1")).rows[0];
        const login = (old ? String(old.username) : process.env.ADMIN_EMAIL || process.env.ADMIN_USERNAME || "").trim().toLowerCase();
        const hash = old ? String(old.password) : process.env.ADMIN_PASSWORD ? await bcrypt.hash(process.env.ADMIN_PASSWORD, 10) : "";
        if (login && hash) {
          const isPhone = /^\d{10}$/.test(login);
          await c.execute({
            sql: `INSERT INTO users (name, email, phone, password, role, status, avatar) VALUES (?, ?, ?, ?, 'admin', 'active', ?)
                  ON CONFLICT(${isPhone ? "phone" : "email"}) DO UPDATE SET role = 'admin', status = 'active', password = excluded.password`,
            args: [old ? `${old.first_name || ""} ${old.last_name || ""}`.trim() : "Admin", isPhone ? null : login, isPhone ? login : null, hash, String(old?.avatar || "")],
          });
        }
      }

      // Seed sample data exactly ONCE per database. The marker row is claimed atomically, so concurrent
      // cold-start requests can't both seed, and deleting the samples later never brings them back.
      const claim = await c.execute("INSERT OR IGNORE INTO meta (key, value) VALUES ('seeded', '1')");
      if (claim.rowsAffected === 1) {
        try {
          const r = await c.execute("SELECT COUNT(*) AS n FROM products");
          if (Number(r.rows[0].n) === 0)
            await c.batch(
              [
                ...SEED_CATEGORIES.map((name) => ({ sql: "INSERT OR IGNORE INTO categories (name) VALUES (?)", args: [name] })),
                ...SEED.map(([title, description, price, stock, sizes, image, cat]) => ({
                  sql: "INSERT INTO products (title, description, price, stock, sizes, image_url, images, category_id, created_at) VALUES (?,?,?,?,?,?,?,(SELECT id FROM categories WHERE name = ?),datetime('now'))",
                  args: [title, description, price, stock, sizes, image, JSON.stringify([image]), cat],
                })),
              ],
              "write"
            );
        } catch (e) {
          await c.execute("DELETE FROM meta WHERE key = 'seeded'").catch(() => {}); // let the next request retry
          throw e;
        }
      }
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready.then(getClient);
}
