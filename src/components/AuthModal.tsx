"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "./Providers";
import { toast } from "./Toaster";
import Req from "./Req";
import FieldError from "./FieldError";
import { type Errors, firstError, validateAuth } from "@/lib/validate";

export default function AuthModal() {
  const { authOpen, closeAuth, setUser, afterAuth } = useApp();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  if (!authOpen) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ve = validateAuth({ identifier, password }, mode); // same rules the server enforces
    setErrs(ve);
    if (firstError(ve)) return;
    setBusy(true);
    const r = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { toast.error(d.error || "Something went wrong"); return; }
    if (d.admin) { // the admin's email: straight to the dashboard
      toast.success("Welcome back, admin");
      setIdentifier(""); setPassword(""); setErrs({}); closeAuth();
      router.push("/admin"); router.refresh();
      return;
    }
    toast.success(mode === "login" ? "Logged in successfully" : "Account created — welcome to enteCart.kerala!");
    setUser(d.user); setIdentifier(""); setPassword(""); setErrs({});
    afterAuth();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} noValidate className="card w-full max-w-sm space-y-4 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-brand-700">{mode === "login" ? "Welcome back" : "Create account"}</h2>
            <p className="text-sm text-gray-500">Use your 10-digit phone number or Gmail</p>
          </div>
          <button type="button" onClick={closeAuth} className="text-2xl leading-none text-gray-400 hover:text-gray-700" aria-label="Close">×</button>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="auth-id">Phone number or Gmail<Req /></label>
          <input id="auth-id" className="input" placeholder="Phone number or Gmail" value={identifier} maxLength={80} autoComplete="username" onChange={(e) => setIdentifier(e.target.value)} autoFocus />
          <FieldError msg={errs.identifier} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="auth-pw">Password<Req /></label>
          <input id="auth-pw" className="input" type="password" placeholder="Password (6–72 characters)" value={password} maxLength={72} autoComplete={mode === "login" ? "current-password" : "new-password"} onChange={(e) => setPassword(e.target.value)} />
          <FieldError msg={errs.password} />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}</button>
        <p className="text-center text-sm text-gray-600">
          {mode === "login" ? "New here?" : "Already registered?"}{" "}
          <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErrs({}); }}>
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </form>
    </div>
  );
}
