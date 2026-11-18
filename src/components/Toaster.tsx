"use client";
import { useEffect, useState } from "react";

type T = { id: number; type: "success" | "error"; text: string };
const EVT = "ek-toast";

/** Call from anywhere (client code): toast.success("Saved") / toast.error("Oops") */
export const toast = {
  success: (text: string) => window.dispatchEvent(new CustomEvent(EVT, { detail: { type: "success", text } })),
  error: (text: string) => window.dispatchEvent(new CustomEvent(EVT, { detail: { type: "error", text } })),
};

export default function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const { type, text } = (e as CustomEvent).detail;
      const id = ++n;
      setItems((l) => [...l, { id, type, text }]);
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 3500);
    };
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);

  return (
    <div className="pointer-events-none fixed right-0 top-4 z-[100] flex w-full max-w-md flex-col items-end gap-3 px-4" aria-live="polite">
      {items.map((t) => {
        const ok = t.type === "success";
        return (
          <div key={t.id} role="status" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}
            className={`pointer-events-auto relative flex w-full max-w-md animate-[toast-up_.3s_cubic-bezier(.2,.9,.3,1.2)] cursor-pointer items-center gap-3 overflow-hidden rounded-2xl px-5 py-4 text-white shadow-2xl ${ok ? "bg-brand-800" : "bg-red-700"}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg">{ok ? "🎉" : "⚠️"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-white/70">{ok ? "Success" : "Error"}</p>
              <p className="text-sm font-medium leading-snug">{t.text}</p>
            </div>
            <span className="text-xl leading-none text-white/60">×</span>
            <span className="absolute bottom-0 left-0 h-1 w-full origin-left bg-white/50 animate-[toast-bar_3.5s_linear_forwards]" />
          </div>
        );
      })}
    </div>
  );
}
