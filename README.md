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
| `ADMIN_EMAIL` | admin email — logging in with it in the normal login modal opens the admin dashboard |
| `ADMIN_PASSWORD` | admin password |

## Deploy to Vercel
Push to GitHub → import in Vercel → add the 4 env vars → Deploy.

## Notes
- Passwords hashed with bcrypt; sessions are signed HttpOnly JWT cookies.
- Order prices/stock are re-read from the DB server-side; stock is decremented on order.
- `orders` has extra `user_id` and `total` columns (for "My Orders" and totals); `users` has `created_at`.

## Security & validation
- One shared rule set (`src/lib/validate.ts`) runs in the browser forms **and** is re-run on every API route; the server never trusts the client.
- Prices, titles, sizes and stock are always read from the DB when an order is placed; stock is reserved atomically (no overselling).
- Rate limits (DB-backed): login, admin login, signup, password change, order placement. CSRF check in `src/middleware.ts`.
- bcrypt password hashing, signed HttpOnly cookies (admin: SameSite=Strict), request body size caps, security headers.
- In production `SESSION_SECRET` (32+ chars) is mandatory.
