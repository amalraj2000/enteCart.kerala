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
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 3000);
    };
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);

  return (
    <div className="pointer-events-none fixed right-0 top-3 z-[100] flex w-full max-w-xs flex-col items-end gap-2 px-3" aria-live="polite">
      {items.map((t) => {
        const ok = t.type === "success";
        return (
          <div key={t.id} role="status" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}
            className={`pointer-events-auto relative flex w-fit max-w-full animate-[toast-up_.25s_ease-out] cursor-pointer items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-white shadow-lg ${ok ? "bg-brand-800" : "bg-red-700"}`}>
            <span className="shrink-0 text-sm" aria-hidden>{ok ? "✓" : "⚠️"}</span>
            <p className="min-w-0 text-xs font-medium leading-snug">{t.text}</p>
            <span className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-white/50 animate-[toast-bar_3s_linear_forwards]" />
          </div>
        );
      })}
    </div>
  );
}
