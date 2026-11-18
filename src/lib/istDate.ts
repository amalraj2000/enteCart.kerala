/** The shop works in Indian Standard Time (UTC+5:30); the database stores UTC. These helpers keep every date the owner sees in IST. */
export const istDay = (offsetDays = 0) => new Date(Date.now() + 330 * 60_000 + offsetDays * 86_400_000).toISOString().slice(0, 10); // "2026-11-18"
export const istMonth = () => istDay().slice(0, 7); // "2026-11"
export const isRealDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
export const isMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** "2026-11-18 13:23:53" (UTC, as stored) → "18 Nov 2026, 6:53 pm" (IST). */
export function formatIst(utc: unknown): string {
  const s = String(utc ?? "");
  const d = new Date(s.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}
export const longDay = (day: string) => new Date(day + "T00:00:00Z").toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
export const longMonth = (m: string) => new Date(m + "-01T00:00:00Z").toLocaleDateString("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });
