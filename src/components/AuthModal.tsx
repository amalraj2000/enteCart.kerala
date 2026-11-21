"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "./Providers";
import { toast } from "./Toaster";
import Req from "./Req";
import FieldError from "./FieldError";
import { type Errors, firstError, validateAuth, validateIdentifier } from "@/lib/validate";

export default function AuthModal() {
  const { authOpen, closeAuth, setUser, afterAuth } = useApp();
  const [mode, setMode] = useState<"login" | "register" | "quick">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [newHint, setNewHint] = useState(false); // floating "new here? register" tip after a failed login
  const router = useRouter();
  useEffect(() => { // the tip hides itself after a few seconds, and whenever the modal closes or switches mode
    if (!newHint) return;
    const t = setTimeout(() => setNewHint(false), 9000);
    return () => clearTimeout(t);
  }, [newHint]);
  useEffect(() => { if (!authOpen) setNewHint(false); }, [authOpen]);
  if (!authOpen) return null;

  async function quick() {
    const msg = validateIdentifier(identifier);
    setErrs(msg ? { identifier: msg } : {});
    if (msg) return;
    setBusy(true);
    const r = await fetch("/api/auth/quick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast.error(d.error || "Could not log in");
    toast.success("Logged in successfully");
    setUser(d.user); setIdentifier(""); setPassword(""); setErrs({});
    afterAuth(); // carries on to wherever the customer was going (e.g. checkout)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "quick") return quick();
    const ve = validateAuth({ identifier, password }, mode); // same rules the server enforces
    setErrs(ve);
    if (firstError(ve)) return;
    setBusy(true);
    const r = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      toast.error(d.error || "Something went wrong");
      // A wrong login is often a first-time visitor who hasn't registered yet. The same tip is shown for every failed login,
      // so it never reveals whether an account exists.
      if (mode === "login" && r.status === 401) setNewHint(true);
      return;
    }
    if (d.admin) { // the admin's email: straight to the dashboard
      toast.success(d.welcome ? `Welcome, ${d.welcome}` : "Welcome back");
      setIdentifier(""); setPassword(""); setErrs({}); closeAuth();
      router.push("/admin"); router.refresh();
      return;
    }
    toast.success(mode === "login" ? "Logged in successfully" : "Registered successfully — welcome to enteCart.kerala!");
    setUser(d.user); setIdentifier(""); setPassword(""); setErrs({});
    afterAuth();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {newHint && mode === "login" && (
        <div role="status" className="fixed inset-x-0 top-16 z-[60] mx-auto flex w-[calc(100%-2rem)] max-w-sm animate-[toast-up_.25s_ease-out] items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-xl">
          <span className="text-xl" aria-hidden>👋</span>
          <div className="min-w-0 flex-1 text-sm text-amber-900">
            <p className="font-semibold">New to enteCart.kerala?</p>
            <p>If you haven’t created an account yet, please click <b>Register</b> first.</p>
            <button type="button" className="mt-2 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700"
              onClick={() => { setMode("register"); setErrs({}); setNewHint(false); }}>Register now</button>
          </div>
          <button type="button" aria-label="Dismiss" className="text-xl leading-none text-amber-700/70 hover:text-amber-900" onClick={() => setNewHint(false)}>×</button>
        </div>
      )}
      <form onSubmit={submit} noValidate className="card max-h-[92vh] w-full max-w-sm space-y-4 overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-brand-700">{mode === "quick" ? "Continue without a password" : mode === "login" ? "Welcome back" : "Register"}</h2>
            <p className="text-sm text-gray-500">{mode === "quick" ? "Just enter your phone number or Gmail" : "Use your 10-digit phone number or Gmail"}</p>
          </div>
          <button type="button" onClick={closeAuth} className="text-2xl leading-none text-gray-400 hover:text-gray-700" aria-label="Close">×</button>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="auth-id">Phone number or Gmail<Req /></label>
          <input id="auth-id" className="input" placeholder="Phone number or Gmail" value={identifier} maxLength={80} autoComplete="username" onChange={(e) => setIdentifier(e.target.value)} autoFocus />
          <FieldError msg={errs.identifier} />
        </div>
        {mode === "quick" ? (
          <>
            <button className="btn-primary w-full" disabled={busy}>{busy ? "Please wait…" : "Continue"}</button>
            <p className="text-center text-sm text-gray-600">
              <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => { setMode("login"); setErrs({}); }}>Use a password instead</button>
            </p>
          </>
        ) : (
          <>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="auth-pw">Password<Req /></label>
            <input id="auth-pw" className="input" type="password" placeholder="Password (6–72 characters)" value={password} maxLength={72} autoComplete={mode === "login" ? "current-password" : "new-password"} onChange={(e) => setPassword(e.target.value)} />
            <FieldError msg={errs.password} />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Register"}</button>
          <p className="text-center text-sm text-gray-600">
            {mode === "login" ? "New here?" : "Already registered?"}{" "}
            <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErrs({}); setNewHint(false); }}>
              {mode === "login" ? "Register" : "Log in"}
            </button>
          </p>
            <button type="button" className="w-full rounded-lg border border-brand-600 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50" onClick={() => { setMode("quick"); setErrs({}); setNewHint(false); }}>Continue without a password</button>
          </>
        )}
      </form>
    </div>
  );
}
