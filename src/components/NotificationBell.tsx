"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: number; type: string; title: string; body: string; link: string; read: boolean; created_at: string };
const POLL_MS = 60_000;

/** "2 min ago" / "3 h ago" / "12 Nov" from the UTC timestamp the database stores. */
function ago(utc: string): string {
  const t = new Date(utc.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(t)) return "";
  const m = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  if (m < 60 * 24 * 7) return `${Math.round(m / 1440)} d ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

/** Bell in the header for a logged-in customer: unread count + a list of order / review updates. */
export default function NotificationBell({ userId }: { userId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const epoch = useRef(0); // bumped on every local change, so a slower refresh that started earlier can't overwrite it

  const load = useCallback(async () => {
    const mine = epoch.current;
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      if (mine !== epoch.current) return; // the customer changed something while this was loading: that is newer
      setItems(d.items || []); setUnread(d.unread || 0);
    } catch { /* offline: keep what we have */ }
  }, []);

  // Fetch now, then every minute while the tab is visible, and again whenever the tab regains focus.
  useEffect(() => {
    setItems([]); setUnread(0); load();
    const tick = () => { if (document.visibilityState === "visible") load(); };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); window.removeEventListener("focus", tick); };
  }, [userId, load]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", click); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);

  async function markRead(body: { id: number } | { all: true }) {
    epoch.current++;
    await fetch("/api/notifications", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    load(); // sync with the server once it has saved
  }
  function openItem(n: Item) {
    setOpen(false);
    if (!n.read) { setItems((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x))); setUnread((u) => Math.max(0, u - 1)); markRead({ id: n.id }); }
    if (n.link.startsWith("/") && !n.link.startsWith("//")) router.push(n.link); // links are server-built internal paths; never follow anything else
  }
  function markAll() { setItems((l) => l.map((x) => ({ ...x, read: true }))); setUnread(0); markRead({ all: true }); }

  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => { setOpen((o) => !o); if (!open) load(); }} aria-haspopup="true" aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} title="Notifications"
        className="btn-outline relative !px-2.5">
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8.5 3 8.5H3S6 15 6 8" /><path d="M10.3 20a2 2 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="card fixed left-3 right-3 top-16 z-50 overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2.5">
            <h2 className="font-bold">Notifications</h2>
            {unread > 0 && <button type="button" onClick={markAll} className="text-xs font-semibold text-brand-700 hover:underline">Mark all as read</button>}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500">No notifications yet.<br />We’ll tell you here when your order or review status changes.</p>
          ) : (
            <ul className="max-h-[70vh] divide-y overflow-y-auto sm:max-h-96">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => openItem(n)} className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-brand-50 ${n.read ? "" : "bg-brand-50/60"}`}>
                    <span className="mt-0.5 text-lg" aria-hidden>{n.type === "review" ? "⭐" : "🧾"}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.read ? "font-medium text-gray-800" : "font-bold text-gray-900"}`}>{n.title}</span>
                      <span className="mt-0.5 block text-sm leading-snug text-gray-600">{n.body}</span>
                      <span className="mt-1 block text-xs text-gray-400">{ago(n.created_at)}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
