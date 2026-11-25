"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "./Providers";
import { toast } from "./Toaster";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const EVT = "ek-install-ready";
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS reports as a Mac
const isAndroid = () => /android/i.test(navigator.userAgent);
/** The app-like extras (offline banner, update banner, notifications prompt) are only for the installed app on an iPhone/iPad or Android phone. */
const installedMobile = () => standalone() && (isIos() || isAndroid());

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Subscribes this device and tells the server who it belongs to. Returns false when it could not be done. */
async function pushSubscribe(scope: "user" | "admin"): Promise<boolean> {
  try {
    const key = (await (await fetch("/api/push/key", { cache: "no-store" })).json()).key as string;
    if (!key) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
    const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, subscription: sub.toJSON() }) });
    return r.ok;
  } catch { return false; }
}

const bar = "fixed inset-x-3 z-[90] mx-auto max-w-md rounded-xl px-4 py-3 text-sm shadow-lg";
const aboveNav = "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]";

/**
 * Mounted once in the layout. Everywhere: registers the service worker (production only) and keeps the browser's "install" offer for later.
 * In the installed phone app only: offline banner, "Update available" banner, and the "turn on notifications" prompt.
 */
export function PwaRegister() {
  const { user } = useApp();
  const pathname = usePathname();
  const scope: "user" | "admin" = pathname.startsWith("/admin") ? "admin" : "user";
  const [app, setApp] = useState(false);
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    setApp(installedMobile());
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloading && waitingRef.current) { reloading = true; location.reload(); } });
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
        const watch = (w: ServiceWorker | null) => w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) setWaiting(w); });
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => watch(reg.installing));
        const check = () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); };
        document.addEventListener("visibilitychange", check);
        setInterval(check, 30 * 60_000);
      }).catch(() => {});
    }
    const onPrompt = (e: Event) => { e.preventDefault(); (window as any).__ekInstall = e; window.dispatchEvent(new Event(EVT)); };
    const onInstalled = () => { (window as any).__ekInstall = null; window.dispatchEvent(new Event(EVT)); toast.success("enteCart installed 🎉"); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  const waitingRef = useRef<ServiceWorker | null>(null);
  waitingRef.current = waiting;

  // Internet connection: show the banner while offline, hide it again the moment we're back.
  useEffect(() => {
    if (!app) return;
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync); window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, [app]);

  // Notifications: if already allowed, quietly attach this device to whoever is logged in; if not decided yet, offer it.
  const loggedIn = scope === "admin" || !!user;
  useEffect(() => {
    if (!app || !loggedIn || !("Notification" in window) || !("PushManager" in window) || process.env.NODE_ENV !== "production") { setAsk(false); return; }
    if (Notification.permission === "granted") { pushSubscribe(scope); setAsk(false); return; }
    let hidden = false;
    try { hidden = Date.now() - Number(localStorage.getItem("ek_push_later") || 0) < 7 * 864e5; } catch { /* private mode */ }
    setAsk(Notification.permission === "default" && !hidden);
  }, [app, loggedIn, scope, user?.id]);

  async function enable() {
    setAsk(false);
    const perm = await Notification.requestPermission(); // must run straight from the tap (iOS requirement)
    if (perm !== "granted") return;
    if (await pushSubscribe(scope)) toast.success("Notifications turned on 🔔");
    else toast.error("Couldn’t turn on notifications. Please try again later.");
  }
  function later() { setAsk(false); try { localStorage.setItem("ek_push_later", String(Date.now())); } catch { /* ignore */ } }

  if (!app) return null;
  return (
    <>
      {offline && (
        <div role="status" className="fixed inset-x-0 top-0 z-[95] bg-gray-900 px-4 pb-1.5 pt-[calc(0.375rem+env(safe-area-inset-top))] text-center text-xs font-medium text-white">
          📡 You’re offline — showing saved pages
        </div>
      )}
      {waiting && (
        <div role="alert" className={`${bar} ${aboveNav} flex items-center gap-3 bg-gray-900 text-white`}>
          <span className="flex-1">A new version of enteCart is available.</span>
          <button type="button" className="rounded-lg bg-white px-3 py-1.5 font-semibold text-gray-900" onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}>Refresh</button>
        </div>
      )}
      {ask && !waiting && (
        <div role="dialog" className={`${bar} ${aboveNav} border border-brand-100 bg-white text-gray-800`}>
          <p className="font-semibold">🔔 Get order updates</p>
          <p className="mt-0.5 text-xs text-gray-600">{scope === "admin" ? "Know the moment a new order or review comes in." : "We’ll tell you when your order is confirmed, shipped or delivered."}</p>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="rounded-lg px-3 py-1.5 text-gray-600" onClick={later}>Not now</button>
            <button type="button" className="rounded-lg bg-brand-600 px-3 py-1.5 font-semibold text-white" onClick={enable}>Turn on</button>
          </div>
        </div>
      )}
    </>
  );
}

const isSafari = () => !/crios|fxios|edgios|opios|gsa|instagram|fban|fbav|line|whatsapp/i.test(navigator.userAgent);

function IosGuide({ onClose }: { onClose: () => void }) {
  const [safari, setSafari] = useState(true);
  useEffect(() => { setSafari(isSafari()); }, []);
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={() => onClose()}>
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5 text-left text-sm text-gray-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-base font-semibold">Install enteCart on your iPhone</h3>
            {!safari && <p className="mb-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">This browser may not offer “Add to Home Screen”. Open this page in <b>Safari</b> for best results.</p>}
            <ol className="list-decimal space-y-2 pl-5 py-2">
              <li>Tap the <b>Share</b> button <span aria-hidden>(⬆︎ square with arrow)</span> in the browser toolbar. If you don’t see it, tap <b>⋯</b> first.</li>
              <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
              <li>Tap <b>Add</b> — enteCart now appears on your home screen.</li>
            </ol>
            <button type="button" className="mt-2 w-full rounded-lg bg-brand-600 py-2 font-medium text-white" onClick={() => onClose()}>Got it</button>
          </div>
        </div>
  );
}

/** "📲 Install app" link: appears only where installing is possible (Android/desktop Chrome & Edge) or, on iPhone/iPad (no install API exists there), opens a step-by-step guide. */
export function InstallApp({ className = "" }: { className?: string }) {
  const [can, setCan] = useState(false);
  const [ios, setIos] = useState(false);
  const [guide, setGuide] = useState(false);
  useEffect(() => {
    const check = () => setCan(!!(window as any).__ekInstall && !standalone());
    setIos(isIos() && !standalone());
    check();
    window.addEventListener(EVT, check);
    return () => window.removeEventListener(EVT, check);
  }, []);
  if (!can && !ios) return null;
  return (
    <>
      <button type="button" className={className} onClick={async () => {
        const p = (window as any).__ekInstall as Prompt | undefined;
        if (p) { await p.prompt(); await p.userChoice.catch(() => {}); (window as any).__ekInstall = null; setCan(false); }
        else setGuide(true);
      }}>📲 Install app</button>
      {guide && <IosGuide onClose={() => setGuide(false)} />}
    </>
  );
}
