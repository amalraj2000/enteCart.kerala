"use client";
import { useEffect, useState } from "react";
import { toast } from "./Toaster";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const EVT = "ek-install-ready";
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;

/** Mounted once in the layout: registers the service worker (production only) and keeps the browser's "install" offer for later. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    const onPrompt = (e: Event) => { e.preventDefault(); (window as any).__ekInstall = e; window.dispatchEvent(new Event(EVT)); };
    const onInstalled = () => { (window as any).__ekInstall = null; window.dispatchEvent(new Event(EVT)); toast.success("enteCart installed 🎉"); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  return null;
}

/** "📲 Install app" link: appears only where installing is possible (Android/desktop Chrome & Edge) or, on iPhone/iPad, shows how. */
export function InstallApp({ className = "" }: { className?: string }) {
  const [can, setCan] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const check = () => setCan(!!(window as any).__ekInstall && !standalone());
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone());
    check();
    window.addEventListener(EVT, check);
    return () => window.removeEventListener(EVT, check);
  }, []);
  if (!can && !ios) return null;
  return (
    <button type="button" className={className} onClick={async () => {
      const p = (window as any).__ekInstall as Prompt | undefined;
      if (p) { await p.prompt(); await p.userChoice.catch(() => {}); (window as any).__ekInstall = null; setCan(false); }
      else toast.success("Tap the Share icon, then “Add to Home Screen”");
    }}>📲 Install app</button>
  );
}
