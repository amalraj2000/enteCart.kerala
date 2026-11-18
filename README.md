# enteCart.kerala

Next.js 15 (App Router) + Tailwind + Turso (`@libsql/client`). No local filesystem use in production.

## Setup
```bash
npm install
cp .env.example .env.local      # fill in values
npm run dev                     # http://localhost:3000
```
Without `TURSO_DATABASE_URL`, dev falls back to a local `file:local.db` (gitignored). Tables are created and 4 sample products seeded automatically on first request.

## Env vars
| Var | Purpose |
|---|---|
| `TURSO_DATABASE_URL` | `turso db show <db> --url` |
| `TURSO_AUTH_TOKEN` | `turso db tokens create <db>` |
| `SESSION_SECRET` | 32+ random chars; signs session cookies |
| `ADMIN_EMAIL` | email of the admin account. On first start it is created as a row in `users` with `role = 'admin'`; logging in with it in the normal login modal opens the dashboard |
| `ADMIN_PASSWORD` | initial admin password (only used when the admin user is first created; change it later on the admin Account page) |

## Deploy to Vercel
Push to GitHub → import in Vercel → add the 4 env vars → Deploy.

## Notes
- Passwords hashed with bcrypt; sessions are signed HttpOnly JWT cookies.
- Order prices/stock are re-read from the DB server-side; stock is decremented on order.
- `orders` has extra `user_id` and `total` columns (for "My Orders" and totals); `users` has `created_at`.

## Security & validation
- One shared rule set (`src/lib/validate.ts`) runs in the browser forms **and** is re-run on every API route; the server never trusts the client.
- Prices, titles, sizes and stock are always read from the DB when an order is placed; stock is reserved atomically (no overselling).
- Rate limits (DB-backed): login, admin login, register, password change, order placement. CSRF check in `src/middleware.ts`.
- bcrypt password hashing, signed HttpOnly cookies (admin: SameSite=Strict), request body size caps, security headers.
- In production `SESSION_SECRET` (32+ chars) is mandatory.

## Database layout
| Table | Columns |
|---|---|
| `users` | `id`, `name`, `email`, `phone`, `password` (bcrypt), `role` (`user` / `admin`), `status`, `avatar`, `address_id` → `addresses.id`, `created_at` |
| `addresses` | `id`, `user_id` → `users.id`, `full_name`, `phone`, `house_name`, `street_name`, `city`, `state`, `pincode` |
| `orders` | `id`, `user_id` → `users.id`, `address_id` → `addresses.id`, shipping snapshot (`customer_name`, `phone`, `house_name`, `street_name`, `city`, `state`, `pincode`), `total`, `status`, `created_at` |
| `order_items` | `id`, `order_id` → `orders.id`, `product_id` → `products.id`, `title`, `size`, `qty`, `price`, `image_url` |
| `products`, `categories`, `product_images`, `rate_limits`, `meta` | catalogue, uploaded photos, security counters, one-time flags |

Orders keep a snapshot of the shipping address and of each line's title/price, so history stays correct if a customer edits their address or a product is changed or deleted.
Databases created with the older layout are upgraded automatically (in one transaction) on the first request.

## WhatsApp order alerts
Every new order sends a WhatsApp message to the owner: "🛒 New order received! Order #12 • ₹2,997 • 3 items" with a link to the order in admin.
Uses the free [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/) service (unofficial, fine for one owner):
1. Save **+34 644 51 95 23** in your phone contacts (name it CallMeBot).
2. On WhatsApp, send that contact the message: `I allow callmebot to send me messages`
3. It replies with your **API key**.
4. Add `ADMIN_WHATSAPP` (your number, e.g. `919544437950`) and `CALLMEBOT_API_KEY` in Vercel → Environment Variables, then Redeploy.
Nothing is sent (and nothing breaks) while either variable is empty. Customer name, phone and address are never included in the message.
