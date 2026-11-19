# enteCart.kerala — project map (read this first, then open only the files you need)

Kerala e-commerce shop. **Next.js 15 App Router + React 19 + TypeScript + Tailwind 3 + Turso/libSQL** (`@libsql/client`). Deploys to Vercel (region `bom1`). No filesystem writes in prod. Prices in ₹ (INR), dates in IST. Run: `npm run dev` / `build` / `lint`. No test suite.

## Roles
- **Customer** (`users.role='user'`): login by email *or* phone; cookie `ek_session` (JWT, 30d, SameSite=Lax).
- **Owner admin** (`role='admin'`): created from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on first start; edits everything; only one who manages Admins/sub-admins.
- **Sub admin / vendor** (`role='subadmin'`, `vendor_name` = "Sold by …"): can edit only rows they created (`created_by`); sees all orders but may change only orders containing their products (`lib/permissions.ts`).
- Staff cookie `ek_admin` (JWT, 8h, SameSite=Strict), tied to a password fingerprint (`ph`) so password reset kills old sessions. Guards: `getUser`, `getAdmin`, `getSuperAdmin`, `isAdmin` in `lib/session.ts` (always re-check DB).

## Security rules added by the audit (keep following them)
- **Every admin page must call `requireAdmin()` / `requireSuperAdmin()` (`lib/session.ts`) itself** — the admin layout is NOT a security boundary (RSC requests skip it).
- Customer + staff sessions carry a password fingerprint `ph`; password change re-issues the session and ends all others.
- Staff passwords ≥10 chars (`STAFF_PASSWORD_MIN`); login is rate-limited per IP+account and per account.
- Changing/deleting a *super admin* (login, status, password, role) needs the actor's own password (`confirm_password`).
- Order status moves are forward-only (`NEXT` map in `api/admin/orders/[id]`); max 3 open COD orders per customer; qty ≤20 per line.
- Product edit sends `stock_base`; server applies the stock *delta*, not an overwrite.
- `POST /api/payments/webhook` (HMAC, `RAZORPAY_WEBHOOK_SECRET`) records captured payments; CSP is Report-Only until verified clean.

## Customer features (pages in `src/app`)
- `/` home: banner slider, category chips, search (`?q`, `?cat`), New Arrivals (14 days) & Best Sellers (≥3 units) sections (toggle in settings), product grid + pagination. Data via `lib/catalog.ts` (`unstable_cache`, 60s, tag `catalog`; `revalidateCatalog()` after admin edits, `revalidateCatalogSoon()` after orders).
- `/product/[id]`: gallery (up to 8 photos), sizes, discount % (from `original_price`), stock, BuyPanel (add to cart / buy now), wishlist button, "Sold by".
- `/cart` (cart in localStorage `ek_cart`, stock re-synced via `/api/stock`), `/checkout` (address + COD or Razorpay online), `/order-success/[id]`.
- `/orders`, `/orders/[id]`: history, cancel while status `Placed` only (`lib/orderPolicy.ts`), Pay-now retry for unpaid online orders.
- `/wishlist`, `/account` (profile, avatar, saved address, password change), AuthModal login/register (`components/AuthModal.tsx`, state in `components/Providers.tsx` → `useApp()`).
- Info pages: `/about`, `/contact`, `/faq`, `/shipping-cancellation` (use `components/InfoPage.tsx`; shop details come from `settings`).
- PWA: `public/sw.js` (never caches HTML/API, only static + product photos; offline page `/offline`), `app/manifest.ts`, `components/Pwa.tsx` (install prompt).

## Admin panel (`src/app/admin/(panel)/…`)
Dashboard w/ stats+charts (`/api/admin/stats`, `components/Charts.tsx`) · Orders (list, date filter IST, status change, detail) · Products (CRUD, multi-photo upload, category, discount, sizes, stock, active/inactive) · Categories · Banners (homepage slider) · Users (view/edit/block/delete customers) · Admins (owner only: create/edit/delete staff) · Payments (Razorpay list + refund button) · Settings (shop phone/WhatsApp/email/address/hours/about/socials, section toggles) · Account (own profile/password). Admin login is the normal login modal with the admin email.

## Order & payment flow (most intricate part)
- Order statuses: `Placed → Confirmed → Shipped → Delivered`, or `Cancelled` (`ORDER_STATUSES` in `lib/types.ts`). `orders.payment_method` = `cod|online`; `payment_status` = `Pending`(COD) | `Unpaid` | `Paid` | `Refunded`.
- `POST /api/orders`: re-reads prices/stock from DB (never trusts client), reserves stock atomically (`UPDATE … WHERE stock >= ?`), snapshots address + item title/price, links saved address, rate-limited. COD → WhatsApp alert immediately (`lib/notify.ts`, CallMeBot, `after()`).
- Online: `/api/payments/create` makes Razorpay order → popup (`lib/payClient.ts`) → `/api/payments/verify` (HMAC signature) → `lib/payments.ts markPaid` (idempotent; sends WhatsApp once). Only ids/amount/method stored, never card data.
- Safety nets: `lib/reconcilePayment.ts` (asks Razorpay if paid when browser never reported; refunds if order already cancelled), `lib/expireUnpaid.ts` (unpaid online orders auto-cancelled after 30 min, stock restored, ≤1/min/instance), `lib/refund.ts` (claims payment row so no double refund; failure shows "Refund due" in admin), `lib/orderStock.ts` (`restockOrder` / `reserveOrder` on cancel/reopen).
- Stock is **per product** (all sizes share it).

## Database (`src/lib/db.ts`, auto-created/migrated on first `db()` call; local dev uses `file:local.db`)
Tables: `users`, `addresses`, `products`(+`original_price`,`status`,`created_by`,`images` JSON,`category_id`), `categories`(status), `product_images`(base64 `data`, served by `/api/images/[id]`), `orders`, `order_items`, `payments`, `banners`, `wishlist`, `settings`(key/value), `rate_limits`, `meta`(one-time flags/`schema_applied`), legacy `admin`. Schema changes = add idempotent `ALTER … .catch(()=>{})` in `setupSchema` and bump `SCHEMA_VERSION`. 4 sample products seeded once. Storefront visibility rule: `lib/visibility.ts` (`VISIBLE` = product active AND category active).

## API routes (`src/app/api`)
- Public/customer: `auth/{login,register,logout,me,profile,password,address}`, `products`, `categories`, `stock`, `wishlist`, `orders` (GET/POST), `orders/[id]` (GET/PATCH cancel), `payments/{create,verify}`, `images/[id]` (`?w=160|320|640|1000` → resized WebP via sharp, 1-year immutable cache; bump `IMG_VERSION` in `lib/imgSrc.ts` if ids reused).
- Admin (`api/admin/*`): `admins`, `banners`, `categories`, `images`(POST upload), `orders`, `password`, `payments/[id]/refund`, `products`, `profile`, `settings`, `stats`, `users`, `logout`.
- Helpers: `lib/http.ts` (`bad`, `readJson` with body-size cap), `lib/paginate.ts`, `lib/rateLimit.ts` (DB-backed, per key/window).

## Validation & security rules
- ALL input rules live in `lib/validate.ts` (`clean*` + `validate*`), used by browser forms **and** every API route — add new rules there only.
- `src/middleware.ts`: CSRF Origin/Sec-Fetch-Site check on all non-GET `/api/*`. `next.config.mjs`: security headers, `sw.js` no-cache.
- bcrypt passwords, rate limits on login/register/password/orders, confirm-password for sensitive admin actions (`lib/confirmPassword.ts`), prod requires `SESSION_SECRET` ≥32 chars.
- Images are uploaded as client-compressed data URLs (`lib/image.ts` `toAvatar` 256px, `toPhoto` ≤1000px) stored in DB — no file storage.

## Components (`src/components`)
Header, MobileNav, Footer(+FooterSwitch), AdminMenu, AuthModal, BannerSlider, ProductCard, CardSlideshow, Gallery, BuyPanel, WishlistButton, Img (responsive via `lib/imgSrc.ts`), OrderList/OrderRow/OrderDetail, PayNow, Pagination, Toaster (`toast.success/error`), FieldError, Req, InfoTip, ShopLoader, Charts, Pwa, Providers (auth + cart + wishlist context).

## Env vars
`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_WHATSAPP`, `CALLMEBOT_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (see `.env.example`; Razorpay test keys = no real money; WhatsApp/Razorpay features no-op when unset).

## Conventions
- Path alias `@/` → `src/`. API routes `export const dynamic = "force-dynamic"`; errors via `bad(msg, status)`.
- Other helper libs: `lib/addresses.ts` (saved-address get/compare), `orderItems.ts` (attach images to order rows), `productImages.ts`, `payLabel.ts`, `staffLabel.ts` ("Former admin" fallback), `userName.ts`, `istDate.ts`, `settings.ts` (`getSettings`, `SETTING_KEYS`, `TOGGLE_KEYS`), `stockCheck.ts` (client cart stock problems).
- Keep this file updated when adding features/tables/routes.
