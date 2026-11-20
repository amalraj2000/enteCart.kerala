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
- `POST /api/payments/webhook` (HMAC, `RAZORPAY_WEBHOOK_SECRET`) records captured payments; CSP is now enforced (single header in `next.config.mjs`); add any new third-party domain there.

## SEO
`lib/site.ts` (`siteUrl()` from `SITE_URL`, `snippet`, `jsonLd`), `app/robots.ts`, `app/sitemap.ts` (visible products + active categories + info pages), per-product `generateMetadata` + Product JSON-LD, category/search metadata on `/`, Organization/WebSite JSON-LD on home. Private pages get `X-Robots-Tag: noindex` via `next.config.mjs`. Set `SITE_URL` in production.

## Theme colour
Owner picks one of the presets in `lib/themes.ts` (Admin → Settings → Theme colour, setting `theme_color`, only preset ids accepted). Tailwind `brand-*` colours are CSS variables (`--brand-50…800`, defaults in `globals.css`); `app/layout.tsx` injects the chosen set, and `getTheme()` (`lib/settings.ts`, cached under tag `catalog`) also feeds the browser bar colour and `manifest.ts`. Use `brand-*` classes, never hardcoded green/hex, so the theme applies everywhere. Status badges (Delivered/Active) stay plain green on purpose.

## Customer features (pages in `src/app`)
- `/` home: banner slider, category chips, search (`?q`, `?cat`), New Arrivals (14 days) & Best Sellers (≥3 units) sections (toggle in settings), product grid + pagination. Data via `lib/catalog.ts` (`unstable_cache`, 60s, tag `catalog`; `revalidateCatalog()` after admin edits, `revalidateCatalogSoon()` after orders).
- `/product/[id]`: optional product video (`products.video_url`: YouTube/Vimeo/direct https .mp4 link, parsed in `lib/video.ts`, shown as the last slide of `components/Gallery.tsx`), gallery (up to 8 photos), sizes, discount % (from `original_price`), stock, BuyPanel (add to cart / buy now), wishlist button, "Sold by".
- `/cart` (cart in localStorage `ek_cart`, stock re-synced via `/api/stock`), `/checkout` (address + COD or Razorpay online), `/order-success/[id]`.
- `/orders`, `/orders/[id]`: history, cancel while status `Placed` only (`lib/orderPolicy.ts`), Pay-now retry for unpaid online orders. On a **Delivered** order each product shows `ReviewBox`: Add Review → (after submit) the customer's own review with Edit / Delete.
- `/wishlist`, `/account` (profile, avatar, saved address, password change), AuthModal login/register (`components/AuthModal.tsx`, state in `components/Providers.tsx` → `useApp()`).
- Info pages: `/about`, `/contact`, `/faq`, `/shipping-cancellation` (use `components/InfoPage.tsx`; shop details come from `settings`).
- PWA: `public/sw.js` (never caches HTML/API, only static + product photos; offline page `/offline`), `app/manifest.ts`, `components/Pwa.tsx` (install prompt).

## Product reviews
Only a customer with a **Delivered** order containing the product may review it (`deliveredOrderFor` in `lib/reviews.ts`, enforced server-side). 1 review per customer per product (UNIQUE), 1–5 stars + required comment + up to 4 optional photos. New and **edited** reviews are `pending`. **Once a review is `approved` the customer can no longer edit or delete it** (server returns 403, guarded inside the UPDATE/DELETE itself; `ReviewBox` hides the buttons) — pending/rejected ones stay editable. Two separate admin switches: approval `status` (pending|approved|rejected) and visibility `active` (1/0, "Inactive" hides an approved review without rejecting it). Shoppers see a review only when `approved AND active` (product page `ReviewsSection`: average, count, 2 at a time + Load more via `GET /api/reviews?product=&offset=`; Product JSON-LD gets `aggregateRating`). Photos live in `review_images`, served by `/api/review-images/[id]` — public only for approved+active reviews (owner + staff before that). Master switch `reviews_enabled` (settings key, super admin, Admin → Reviews) hides Add Review + the product section and blocks create/edit (delete of a non-approved review always allowed). Admin → Reviews is a table (product image, customer name + email/phone, stars, status + Active/Inactive, **View / Edit / Delete**); the View modal sets Approval and Visibility, the Edit modal lets staff correct rating/comment and remove (not add) photos (`PUT /api/admin/reviews/[id]`; status unchanged). Moderation: super admin = all reviews; sub admin = reviews of products they added. Reviews/photos are deleted with their product or customer. Routes: `api/reviews{,/mine,/[id],/photos}`, `api/review-images/[id]`, `api/admin/reviews/{[id],toggle}`.

## Notifications (customers and staff)
Bell icon (`components/NotificationBell.tsx`): unread badge, dropdown of the newest 20, click = mark read + open the link, "Mark all as read"; polls every 60 s while the tab is visible (and on focus). One `notifications` table (user_id, type order|review, title, body, internal `link`, is_read) — staff are `users` rows too, so they use the same table. Created best-effort by `notifyUser()` in `lib/notifications.ts` (never throws; newest 50 kept per user; link must be an internal path). Customer bell → `GET/PUT /api/notifications` (customer cookie); admin-header bell → `GET/PUT /api/admin/notifications` (staff cookie); both only touch the caller's own rows.
- **Customer** is told: admin order status change (`api/admin/orders/[id]`), unpaid online order auto-cancel (`lib/expireUnpaid.ts`), admin review actions (`api/admin/reviews/[id]`: approved / not approved / hidden / visible again / removed). Same status again = nothing; the customer's own actions never notify them.
- **Staff** are told (`notifyStaffNewOrder / notifyStaffOrderCancelled / notifyStaffReview`): new order (COD at once, `api/orders`; online once paid, `lib/payments.ts markPaid`), customer cancelled their order (`api/orders/[id]`), new or edited review waiting for approval (`api/reviews`, `api/reviews/[id]`). **Super admin = everything; a sub admin only orders that contain THEIR products (message shows their share) and reviews of THEIR products.**
- Notifications are deleted with the user/admin account.

## Admin panel (`src/app/admin/(panel)/…`)
Dashboard (deliberately minimal: 4 tiles — orders to process, orders today, revenue this month, low stock — plus a pending-reviews notice, 5 recent orders and stock alerts; sub admins see only their own products, the owner can switch per admin) · Orders (list, date filter IST, status change, detail) · Reviews (moderation + on/off switch) · Products (**Highlight** switch per row → `products.highlighted`, home "⭐ Highlighted" row (up to 8), master switch `show_highlights` in Settings; table: photo, name, status, category, action; CRUD, optional admin-only `product_link` reference URL — never selected by storefront queries, multi-photo upload, category, discount, sizes, stock, active/inactive) · Categories · Banners (homepage slider) · Users (view/edit/block/delete customers) · Admins (owner only: create/edit/delete staff) · Payments (Razorpay list + refund button) · Settings (shop phone/WhatsApp/email/address/hours/about/socials, section toggles, **theme colour**) · Account (own profile/password). Admin login is the normal login modal with the admin email.

## Order & payment flow (most intricate part)
- Order statuses: `Placed → Confirmed → Shipped → Delivered`, or `Cancelled` (`ORDER_STATUSES` in `lib/types.ts`). `orders.payment_method` = `cod|online`; `payment_status` = `Pending`(COD) | `Unpaid` | `Paid` | `Refunded`.
- `POST /api/orders`: re-reads prices/stock from DB (never trusts client), reserves stock atomically (`UPDATE … WHERE stock >= ?`), snapshots address + item title/price, links saved address, rate-limited. COD → owner alert immediately on WhatsApp (CallMeBot) and/or Telegram (bot) — whichever is configured (`lib/notify.ts`, `after()`).
- Online: `/api/payments/create` makes Razorpay order → popup (`lib/payClient.ts`) → `/api/payments/verify` (HMAC signature) → `lib/payments.ts markPaid` (idempotent; sends the WhatsApp/Telegram alert once). Only ids/amount/method stored, never card data.
- Safety nets: `lib/reconcilePayment.ts` (asks Razorpay if paid when browser never reported; refunds if order already cancelled), `lib/expireUnpaid.ts` (unpaid online orders auto-cancelled after 30 min, stock restored, ≤1/min/instance), `lib/refund.ts` (claims payment row so no double refund; failure shows "Refund due" in admin), `lib/orderStock.ts` (`restockOrder` / `reserveOrder` on cancel/reopen).
- Stock is **per product** (all sizes share it).

## Database (`src/lib/db.ts`, auto-created/migrated on first `db()` call; local dev uses `file:local.db`)
Tables: `users`, `addresses`, `products`(+`original_price`,`status`,`created_by`,`images` JSON,`category_id`), `categories`(status), `product_images`(base64 `data`, served by `/api/images/[id]`), `orders`, `order_items`, `payments`, `banners`, `wishlist`, `settings`(key/value), `reviews`, `review_images`, `rate_limits`, `meta`(one-time flags/`schema_applied`), legacy `admin`. Schema changes = add idempotent `ALTER … .catch(()=>{})` in `setupSchema` and bump `SCHEMA_VERSION`. 4 sample products seeded once. Storefront visibility rule: `lib/visibility.ts` (`VISIBLE` = product active AND category active).

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
Header, MobileNav, Footer(+FooterSwitch), AdminMenu, AuthModal, BannerSlider, ProductCard, CardSlideshow, Gallery, BuyPanel, WishlistButton, Img (responsive via `lib/imgSrc.ts`), OrderList/OrderRow/OrderDetail, PayNow, Pagination, Toaster (`toast.success/error`), FieldError, Req, InfoTip, ShopLoader, Pwa, Providers (auth + cart + wishlist context).

## Env vars
`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_WHATSAPP`, `CALLMEBOT_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (comma-separated ok), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (see `.env.example`; Razorpay test keys = no real money; WhatsApp/Razorpay features no-op when unset).

## Conventions
- Path alias `@/` → `src/`. API routes `export const dynamic = "force-dynamic"`; errors via `bad(msg, status)`.
- Other helper libs: `lib/addresses.ts` (saved-address get/compare), `orderItems.ts` (attach images to order rows), `productImages.ts`, `payLabel.ts`, `staffLabel.ts` ("Former admin" fallback), `userName.ts`, `istDate.ts`, `settings.ts` (`getSettings`, `SETTING_KEYS`, `TOGGLE_KEYS`), `stockCheck.ts` (client cart stock problems).
- Keep this file updated when adding features/tables/routes.
