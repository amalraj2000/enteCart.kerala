import { createClient, type Client } from "@libsql/client";

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

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    sizes TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    images TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    house_name TEXT NOT NULL,
    street_name TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    items TEXT NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Placed',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

const ADMIN_TABLE = `CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT ''
  )`;

const IMAGE_TABLE = `CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`;

const CATEGORY_TABLE = `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
  )`;

const RATE_TABLE = `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
  )`;

const SEED_CATEGORIES = ["Sarees", "Men's Wear", "Women's Wear", "Groceries", "Home & Kitchen"];

const SEED = [
  ["Kasavu Cotton Saree", "Traditional Kerala kasavu saree with golden zari border. Soft handloom cotton.", 1299, 25, "Free Size", "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800", "Sarees"],
  ["Men's Mundu (Veshti)", "Pure cotton double mundu with kara border. Perfect for festivals.", 799, 40, "2.0m,2.5m", "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800", "Men's Wear"],
  ["Coconut Oil Cold Pressed 1L", "Pure virgin cold-pressed coconut oil from Kerala farms.", 399, 100, "500ml,1L", "https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=800", "Groceries"],
  ["Cotton Kurta", "Breathable everyday cotton kurta.", 599, 30, "S,M,L,XL", "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800", "Men's Wear"],
];

/** Creates tables (idempotent) and seeds sample products once. Call before any query. */
export function db(): Promise<Client> {
  if (!ready) {
    const c = getClient();
    ready = (async () => {
      await c.batch([...SCHEMA, ADMIN_TABLE, RATE_TABLE, IMAGE_TABLE, CATEGORY_TABLE].map((sql) => ({ sql, args: [] })), "write");
      for (const col of ["first_name", "last_name", "avatar"]) {
        await c.execute(`ALTER TABLE admin ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`).catch(() => {}); // already exists
      }
      await c.execute("ALTER TABLE products ADD COLUMN category_id INTEGER").catch(() => {}); // already exists
      await c.execute("ALTER TABLE products ADD COLUMN images TEXT NOT NULL DEFAULT ''").catch(() => {}); // already exists
      for (const col of ["first_name", "last_name", "avatar", "address"]) {
        await c.execute(`ALTER TABLE users ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`).catch(() => {}); // already exists
      }
      await c.execute("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'").catch(() => {}); // already exists
      const cats = await c.execute("SELECT COUNT(*) AS n FROM categories");
      if (Number(cats.rows[0].n) === 0)
        await c.batch(SEED_CATEGORIES.map((name) => ({ sql: "INSERT INTO categories (name) VALUES (?)", args: [name] })), "write");
      const r = await c.execute("SELECT COUNT(*) AS n FROM products");
      if (Number(r.rows[0].n) === 0) {
        await c.batch(
          SEED.map(([title, description, price, stock, sizes, image, cat]) => ({
            sql: "INSERT INTO products (title, description, price, stock, sizes, image_url, images, category_id) VALUES (?,?,?,?,?,?,?,(SELECT id FROM categories WHERE name = ?))",
            args: [title, description, price, stock, sizes, image, JSON.stringify([image]), cat],
          })),
          "write"
        );
      }
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready.then(getClient);
}
