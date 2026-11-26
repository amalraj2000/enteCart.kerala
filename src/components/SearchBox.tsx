"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Search box for admin lists. Goes to `path?…params&q=…` (page resets to 1); other filters in `params` are kept. */
export default function SearchBox({ path, q, params = {}, placeholder }: { path: string; q: string; params?: Record<string, string>; placeholder: string }) {
  const router = useRouter();
  const [v, setV] = useState(q);
  const go = (text: string) => {
    const p = new URLSearchParams(params);
    if (text.trim()) p.set("q", text.trim());
    const s = p.toString();
    router.push(path + (s ? `?${s}` : ""));
  };
  return (
    <form role="search" className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(v); }}>
      <input className="input min-w-0 flex-1 sm:max-w-sm" type="search" aria-label={placeholder} placeholder={placeholder} maxLength={60} value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn-primary">Search</button>
      {q && <button type="button" className="btn-outline" onClick={() => { setV(""); go(""); }}>Clear</button>}
    </form>
  );
}
