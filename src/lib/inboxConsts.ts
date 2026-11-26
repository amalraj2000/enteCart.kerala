// Client-safe constants for Inbox Orders (no server imports).
export const INBOX_KEY = "inbox_orders_enabled";
export const SOURCES = ["Instagram", "Facebook", "WhatsApp", "Other"] as const;
export const PAY_METHODS = ["Cash on Delivery", "Prepaid", "Other"] as const;
export const PAY_STATUSES = ["Pending", "Paid", "Refunded"] as const;
export const STATUSES = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"] as const;
export const MAX_LINES = 20;
