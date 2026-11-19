/**
 * Shared validation — imported by BOTH the browser forms and the API routes.
 * The server never trusts the browser: every route re-runs these checks on the raw request body.
 */
import { ORDER_STATUSES } from "./types";

export type Errors = Record<string, string>;
export const firstError = (e: Errors): string | null => Object.values(e)[0] ?? null;

/** Non-strings (objects, arrays, numbers, null) become "" so they fail "required" checks. */
export const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);

const NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;
const ADDR = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ,.\-/#&'’()]*$/u;
const SIZE = /^[\p{L}\p{N}][\p{L}\p{N} .\/+-]{0,19}$/u;
const PHONE = /^[6-9]\d{9}$/;
const GMAIL = /^[a-z0-9](?:[a-z0-9._%+-]{0,62})@gmail\.com$/;
const PIN = /^[1-9]\d{5}$/;

export const parseId = (s: unknown): number | null => (typeof s === "string" && /^\d{1,12}$/.test(s) && Number(s) > 0 ? Number(s) : null);

// ---------- credentials ----------
export function validateIdentifier(raw: unknown): string | null {
  const v = str(raw).toLowerCase();
  if (!v) return "Phone number or Gmail is required";
  if (v.length > 80) return "Too long";
  if (/^\d+$/.test(v)) return PHONE.test(v) ? null : "Enter a valid 10-digit Indian mobile number";
  return GMAIL.test(v) ? null : "Enter a valid Gmail address (name@gmail.com) or 10-digit phone";
}
export function validatePassword(raw: unknown, label = "Password"): string | null {
  if (typeof raw !== "string" || !raw) return `${label} is required`;
  if (raw.length < 6) return `${label} must be at least 6 characters`;
  if (raw.length > 72) return `${label} must be at most 72 characters`;
  return null;
}
export function validateAuth(b: Record<string, unknown>, mode: "login" | "register"): Errors {
  const e: Errors = {};
  const raw = str(b.identifier);
  // Login: only basic sanity (the server decides user vs admin). Register: strict phone / Gmail rules.
  const i = mode === "register" ? validateIdentifier(b.identifier) : !raw ? "Phone number or email is required" : raw.length > 80 || /\s/.test(raw) ? "Enter a valid phone number or email" : null;
  if (i) e.identifier = i;
  // login: only presence/length (don't leak the password policy); register: full policy
  const p = mode === "register" ? validatePassword(b.password) : typeof b.password !== "string" || !b.password ? "Password is required" : b.password.length > 72 ? "Password is too long" : null;
  if (p) e.password = p;
  return e;
}
export function validatePasswordChange(b: Record<string, unknown>): Errors {
  const e: Errors = {};
  if (typeof b.currentPassword !== "string" || !b.currentPassword || b.currentPassword.length > 72) e.currentPassword = "Enter your current password";
  const n = validatePassword(b.newPassword, "New password");
  if (n) e.newPassword = n;
  else if (b.newPassword === b.currentPassword) e.newPassword = "New password must be different from the current one";
  if (b.confirmPassword !== b.newPassword) e.confirmPassword = "Passwords do not match";
  return e;
}

// ---------- names / profile ----------
function nameErr(v: string, label: string, required: boolean): string | null {
  if (!v) return required ? `${label} is required` : null;
  if (v.length > 50) return `${label} must be at most 50 characters`;
  if (!NAME.test(v)) return `${label} can only contain letters, spaces, . ' -`;
  return null;
}
export const cleanProfile = (b: Record<string, unknown>) => ({ name: str(b.name).replace(/\s+/g, " "), avatar: typeof b.avatar === "string" ? b.avatar : "" });
export function validateProfile(p: ReturnType<typeof cleanProfile>): Errors {
  const e: Errors = {};
  const n = nameErr(p.name, "Name", true);
  if (n) e.name = n; else if (p.name.length < 2) e.name = "Name must be at least 2 characters";
  if (p.avatar && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(p.avatar) || p.avatar.length > 300_000)) e.avatar = "Invalid or too large image";
  return e;
}
export const validateAvatar = (avatar: string): string | null =>
  avatar && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(avatar) || avatar.length > 300_000) ? "Invalid or too large image" : null;

// ---------- address ----------
export const ADDRESS_KEYS = ["customer_name", "phone", "house_name", "street_name", "city", "state", "pincode"] as const;
export type Address = Record<(typeof ADDRESS_KEYS)[number], string>;
export const cleanAddress = (b: Record<string, unknown>): Address =>
  Object.fromEntries(ADDRESS_KEYS.map((k) => [k, k === "phone" || k === "pincode" ? str(b[k]).replace(/\s+/g, "") : str(b[k]).replace(/\s+/g, " ")])) as Address;
/** [min, max] lengths per address field — also used for the inputs' maxLength. */
export const ADDRESS_LIMITS = { customer_name: [2, 50], house_name: [2, 50], street_name: [2, 80], city: [2, 40], state: [2, 40] } as const;

export function validateAddress(a: Address): Errors {
  const e: Errors = {};
  const len = (k: keyof typeof ADDRESS_LIMITS, label: string): string | null => {
    const [min, max] = ADDRESS_LIMITS[k];
    if (!a[k]) return `${label} is required`;
    if (a[k].length < min) return `${label} must be at least ${min} characters`;
    if (a[k].length > max) return `${label} must be at most ${max} characters`;
    return null;
  };
  const letters = (k: "customer_name" | "city" | "state", label: string) =>
    len(k, label) ?? (NAME.test(a[k]) ? null : `${label} can only contain letters, spaces, . ' -`);
  const mixed = (k: "house_name" | "street_name", label: string) =>
    len(k, label) ?? (ADDR.test(a[k]) ? null : `${label} can only contain letters, numbers and , . - / # & ' ( )`);

  const checks: [string, string | null][] = [
    ["customer_name", letters("customer_name", "Full name")],
    ["phone", !a.phone ? "Phone number is required" : !/^\d+$/.test(a.phone) ? "Phone number must contain digits only" : a.phone.length !== 10 ? "Phone number must be exactly 10 digits" : null],
    ["house_name", mixed("house_name", "House name")],
    ["street_name", mixed("street_name", "Street name")],
    ["city", letters("city", "City")],
    ["state", letters("state", "State")],
    ["pincode", !a.pincode ? "Pincode is required" : !/^\d+$/.test(a.pincode) ? "Pincode must contain digits only" : a.pincode.length !== 6 ? "Pincode must be exactly 6 digits" : !PIN.test(a.pincode) ? "Pincode cannot start with 0" : null],
  ];
  for (const [k, m] of checks) if (m) e[k] = m;
  return e;
}
// ---------- products
export const PRODUCT_TITLE_MAX = 100;
import { cleanStatus } from "./visibility";
export const cleanProduct = (b: Record<string, unknown>) => ({
  title: str(b.title).replace(/\s+/g, " "),
  description: typeof b.description === "string" ? b.description.trim() : "",
  price: num(b.price),
  original_price: b.original_price === "" || b.original_price == null ? 0 : num(b.original_price), // optional; blank = no discount
  stock: num(b.stock),
  sizes: [...new Set(str(b.sizes).split(",").map((s) => s.trim()).filter(Boolean))].join(","),
  status: cleanStatus(b.status),
  category_id: b.category_id === "" || b.category_id == null ? null : num(b.category_id),
  images: [...new Set((Array.isArray(b.images) ? b.images : b.image_url ? [b.image_url] : []).map(str).filter(Boolean))] as string[],
});
export const PRODUCT_MAX_IMAGES = 8;
export function validateProduct(p: ReturnType<typeof cleanProduct>): Errors {
  const e: Errors = {};
  if (!p.title) e.title = "Title is required";
  else if (p.title.length < 2) e.title = "Title must be at least 2 characters";
  else if (p.title.length > PRODUCT_TITLE_MAX) e.title = `Title must be at most ${PRODUCT_TITLE_MAX} characters`;
  if (p.description.length > 2000) e.description = "Description must be at most 2000 characters";
  if (!Number.isFinite(p.price) || p.price < 1 || p.price > 1_000_000 || Math.round(p.price * 100) / 100 !== p.price) e.price = "Price must be between ₹1 and ₹10,00,000 (max 2 decimals)";
  if (p.original_price !== 0) {
    if (!Number.isFinite(p.original_price) || p.original_price > 1_000_000 || Math.round(p.original_price * 100) / 100 !== p.original_price) e.original_price = "Original price must be a valid amount up to ₹10,00,000 (max 2 decimals)";
    else if (Number.isFinite(p.price) && p.original_price < p.price) e.original_price = "Original price can't be lower than the selling price";
  }
  if (!Number.isInteger(p.stock) || p.stock < 0 || p.stock > 100_000) e.stock = "Stock must be a whole number from 0 to 100000";
  if (p.sizes) {
    const parts = p.sizes.split(",");
    if (parts.length > 15) e.sizes = "At most 15 sizes";
    else if (parts.some((s) => !SIZE.test(s))) e.sizes = "Sizes: comma separated, e.g. S,M,L,XL (letters/numbers, max 20 chars each)";
  }
  if (p.category_id !== null && !(Number.isInteger(p.category_id) && p.category_id > 0)) e.category_id = "Choose a valid category";
  if (p.images.length > PRODUCT_MAX_IMAGES) e.images = `At most ${PRODUCT_MAX_IMAGES} photos`;
  else {
    const bad = p.images.findIndex((u) => {
      if (/^\/api\/images\/\d{1,12}$/.test(u)) return false; // an uploaded photo
      try { const x = new URL(u); return !["http:", "https:"].includes(x.protocol) || u.length > 1000 || /\s/.test(u); } catch { return true; }
    });
    if (bad >= 0) e.images = `Photo ${bad + 1} is invalid — please upload it again`;
  }
  return e;
}

// ---------- orders ----------
export type CartLine = { id: number; size: string; qty: number };
export function validateOrderItems(raw: unknown): { items: CartLine[]; error: string | null } {
  if (!Array.isArray(raw) || raw.length < 1) return { items: [], error: "Your cart is empty" };
  if (raw.length > 30) return { items: [], error: "Too many items in one order" };
  const merged = new Map<string, CartLine>();
  for (const r of raw) {
    const it = (r ?? {}) as Record<string, unknown>;
    const id = typeof it.id === "number" && Number.isInteger(it.id) && it.id > 0 ? it.id : null;
    const qty = typeof it.qty === "number" && Number.isInteger(it.qty) ? it.qty : NaN;
    const size = typeof it.size === "string" ? it.size.trim() : "";
    if (id === null) return { items: [], error: "Invalid product in cart" };
    if (!(qty >= 1 && qty <= 50)) return { items: [], error: "Quantity must be between 1 and 50" };
    if (size.length > 20) return { items: [], error: "Invalid size" };
    const k = `${id}|${size}`;
    const ex = merged.get(k);
    if (ex) ex.qty += qty; else merged.set(k, { id, size, qty });
  }
  return { items: [...merged.values()], error: null };
}
export const validateStatus = (v: unknown, allowed: string[] = ORDER_STATUSES) => typeof v === "string" && allowed.includes(v);

// ---------- categories ----------
export const CATEGORY_NAME_MAX = 30;
export const cleanCategoryName = (v: unknown) => str(v).replace(/\s+/g, " ");
export function validateCategoryName(name: string): string | null {
  if (!name) return "Category name is required";
  if (name.length < 2) return "Category name must be at least 2 characters";
  if (name.length > CATEGORY_NAME_MAX) return `Category name must be at most ${CATEGORY_NAME_MAX} characters`;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} &'’,.\-]*$/u.test(name)) return "Category name can only contain letters, numbers, spaces and & ' , . -";
  return null;
}

// ---------- banners ----------
export const cleanBanner = (b: Record<string, unknown>) => ({
  title: str(b.title).replace(/\s+/g, " "),
  subtitle: str(b.subtitle).replace(/\s+/g, " "),
  button_text: str(b.button_text).replace(/\s+/g, " "),
  link: str(b.link),
  image: str(b.image),
  active: b.active === true || b.active === 1 ? 1 : 0,
  position: num(b.position),
});
export function validateBanner(b: ReturnType<typeof cleanBanner>): Errors {
  const e: Errors = {};
  if (b.title.length < 2 || b.title.length > 60) e.title = "Title must be 2–60 characters";
  if (b.subtitle.length > 120) e.subtitle = "Subtitle must be at most 120 characters";
  if (b.button_text.length > 20) e.button_text = "Button text must be at most 20 characters";
  if (b.link) {
    const internal = /^\/(?!\/)[\w\-./?=&%#]*$/.test(b.link); // e.g. /?category=3 — never "//host" or "javascript:"
    let external = false;
    try { external = new URL(b.link).protocol === "https:"; } catch {}
    if (b.link.length > 300 || (!internal && !external)) e.link = "Link must start with / (a page on this site) or https://";
  }
  if (b.button_text && !b.link) e.link = "Add a link for the button";
  if (b.image && !/^\/api\/images\/\d{1,12}$/.test(b.image)) e.image = "Please upload the banner image again";
  if (!Number.isInteger(b.position) || b.position < 0 || b.position > 1000) e.position = "Invalid position";
  return e;
}

// ---------- shop settings ----------
export const cleanSettings = (b: Record<string, unknown>) => ({
  shop_phone: str(b.shop_phone).replace(/\s+/g, ""), shop_whatsapp: str(b.shop_whatsapp).replace(/[\s+]/g, ""), shop_email: str(b.shop_email).toLowerCase(),
  shop_address: str(b.shop_address), shop_hours: str(b.shop_hours), shop_about: str(b.shop_about),
  social_instagram: str(b.social_instagram), social_facebook: str(b.social_facebook), social_youtube: str(b.social_youtube),
  show_new_arrivals: b.show_new_arrivals === "0" || b.show_new_arrivals === false ? "0" : "1",
  show_best_sellers: b.show_best_sellers === "0" || b.show_best_sellers === false ? "0" : "1",
});
export function validateSettings(v: ReturnType<typeof cleanSettings>): Errors {
  const e: Errors = {};
  if (v.shop_phone && !/^\d{10}$/.test(v.shop_phone)) e.shop_phone = "Phone must be exactly 10 digits";
  if (v.shop_whatsapp && !/^\d{10,13}$/.test(v.shop_whatsapp)) e.shop_whatsapp = "WhatsApp number: 10 digits (or with country code, digits only)";
  if (v.shop_email && (v.shop_email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.shop_email))) e.shop_email = "Enter a valid email address";
  if (v.shop_address.length > 200) e.shop_address = "Address must be at most 200 characters";
  if (v.shop_hours.length > 80) e.shop_hours = "Opening hours must be at most 80 characters";
  if (v.shop_about.length > 250) e.shop_about = "About text must be at most 250 characters";
  for (const k of ["social_instagram", "social_facebook", "social_youtube"] as const) {
    if (!v[k]) continue;
    try { if (new URL(v[k]).protocol !== "https:" || v[k].length > 200) throw 0; } catch { e[k] = "Enter a full link starting with https://"; }
  }
  return e;
}

// ---------- staff (sub admins) ----------
export const VENDOR_NAME_MAX = 60;
export function validateVendorName(v: string): string | null {
  if (!v) return "Vendor name is required";
  if (v.length < 2) return "Vendor name must be at least 2 characters";
  if (v.length > VENDOR_NAME_MAX) return `Vendor name must be at most ${VENDOR_NAME_MAX} characters`;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} &.,'’()\-]*$/u.test(v)) return "Vendor name can only contain letters, numbers, spaces and & . , ' ( ) -";
  return null;
}
export const cleanStaff = (b: Record<string, unknown>) => ({ name: str(b.name).replace(/\s+/g, " "), vendor_name: str(b.vendor_name).replace(/\s+/g, " "), role: (b.role === "admin" ? "admin" : "subadmin") as "admin" | "subadmin", identifier: str(b.identifier).toLowerCase(), password: typeof b.password === "string" ? b.password : "" });
export function validateStaff(v: ReturnType<typeof cleanStaff>): Errors {
  const e: Errors = {};
  const n = nameErr(v.name, "Name", true);
  if (n) e.name = n; else if (v.name.length < 2) e.name = "Name must be at least 2 characters";
  if (v.role === "subadmin") { const vn = validateVendorName(v.vendor_name); if (vn) e.vendor_name = vn; } // super admins don't need a vendor name
  if (!v.identifier) e.identifier = "Email or phone number is required";
  else if (/^\d+$/.test(v.identifier)) { if (!/^\d{10}$/.test(v.identifier)) e.identifier = "Phone number must be exactly 10 digits"; }
  else if (v.identifier.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.identifier)) e.identifier = "Enter a valid email address or 10-digit phone number";
  const p = validatePassword(v.password); if (p) e.password = p;
  return e;
}

// ---------- account details edited by the super admin (customers and sub admins) ----------
export const cleanAccount = (b: Record<string, unknown>) => ({
  name: str(b.name).replace(/\s+/g, " "),
  email: str(b.email).toLowerCase(),
  phone: str(b.phone).replace(/\s+/g, ""),
  vendor_name: str(b.vendor_name).replace(/\s+/g, " "),
});
/** `nameRequired`: sub admins must have a name, customers may not have one yet. `vendor`: only sub admins have a vendor name. */
export function validateAccount(v: ReturnType<typeof cleanAccount>, opts: { nameRequired: boolean; vendor: boolean }): Errors {
  const e: Errors = {};
  const n = nameErr(v.name, "Name", opts.nameRequired);
  if (n) e.name = n; else if (v.name && v.name.length < 2) e.name = "Name must be at least 2 characters";
  if (v.email && (v.email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email))) e.email = "Enter a valid email address";
  if (v.phone && !/^\d{10}$/.test(v.phone)) e.phone = "Phone number must be exactly 10 digits";
  if (!v.email && !v.phone) e.email = "Add an email or a phone number — it is the login";
  if (opts.vendor) { const vn = validateVendorName(v.vendor_name); if (vn) e.vendor_name = vn; }
  return e;
}
