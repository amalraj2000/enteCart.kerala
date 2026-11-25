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

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS reports as a Mac
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
