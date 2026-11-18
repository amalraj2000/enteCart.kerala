"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/Providers";
import { toast } from "@/components/Toaster";
import { inr } from "@/lib/types";
import Req from "@/components/Req";
import InfoTip from "@/components/InfoTip";
import { CANCEL_POLICY } from "@/lib/orderPolicy";
import { openPayment, verifyPayment } from "@/lib/payClient";
import { stockProblems } from "@/lib/stockCheck";
import FieldError from "@/components/FieldError";
import { ADDRESS_LIMITS, type Errors, cleanAddress, firstError, validateAddress } from "@/lib/validate";

const FIELDS: [string, string, string?][] = [
  ["customer_name", "Full Name"], ["phone", "Phone Number", "tel"], ["house_name", "House Name"],
  ["street_name", "Street Name"], ["city", "City"], ["state", "State"], ["pincode", "Pincode", "text"],
];

function Checkout() {
  const { checkoutItems, user, openAuth, clearCart, resetBuyNow, authReady, syncStock } = useApp();
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({ state: "Kerala" });
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [method, setMethod] = useState<"cod" | "online">("cod");
  // Prefill: name from the account, everything else from the most recent order's address.
  useEffect(() => {
    if (!user) return;
    const accountName = user.name || "";
    Promise.all([fetch("/api/auth/address").then((r) => r.json()), fetch("/api/orders").then((r) => r.json())]).then(([a, d]) => {
      const last = a.address || d.orders?.[0]; // saved address wins, else the latest order's
      setForm((f) => ({
        customer_name: accountName || last?.customer_name || "",
        phone: last?.phone || user.phone || "",
        house_name: last?.house_name || "", street_name: last?.street_name || "", city: last?.city || "",
        state: last?.state || "Kerala", pincode: last?.pincode || "",
        ...Object.fromEntries(Object.entries(f).filter(([k, v]) => v && k !== "state")),
      }));
    });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { syncStock(); }, []); // eslint-disable-line react-hooks/exhaustive-deps — re-check live stock when checkout opens
  // While we confirm a payment, stop accidental exits: warn on close/refresh and swallow the Back button.
  useEffect(() => {
    if (!verifying) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const stay = () => history.pushState(null, "", location.href);
    history.pushState(null, "", location.href);
    window.addEventListener("beforeunload", warn);
    window.addEventListener("popstate", stay);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("popstate", stay); };
  }, [verifying]);
  const problems = stockProblems(checkoutItems);
  const total = checkoutItems.reduce((s, i) => s + i.price * i.qty, 0);

  if (!checkoutItems.length) return <p className="card p-8 text-center text-gray-600">Nothing to checkout. <a className="text-brand-700 underline" href="/">Go shopping</a></p>;
  if (authReady && !user)
    return <div className="card p-8 text-center"><p className="mb-3">Please log in to place your order.</p><button className="btn-primary" onClick={() => openAuth()}>Login / Register</button></div>;

  async function place(e: React.FormEvent) {
    e.preventDefault();
    if (problems.length) return toast.error(problems[0]);
    const clean = cleanAddress(form);
    const ve = validateAddress(clean); // same rules the server enforces
    setErrs(ve);
    if (firstError(ve)) return toast.error("Please fix the highlighted fields");
    setBusy(true);
    const r = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...clean, payment_method: method, items: checkoutItems.map((i) => ({ id: i.id, size: i.size, qty: i.qty })) }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(false); return toast.error(d.error || "Could not place order"); }
    // The order exists now (stock reserved). Buy Now leaves the cart untouched; a normal checkout empties it.
    const finish = () => { if (new URLSearchParams(location.search).get("buynow")) resetBuyNow(); else clearCart(); };
    if (method === "cod") {
      setBusy(false); toast.success("Order placed successfully!"); finish(); return router.replace(`/order-success/${d.id}`);
    }
    try {
      finish(); // the order exists; from here the customer is either paying or can resume from My Orders
      await openPayment(d.id, { name: clean.customer_name, contact: clean.phone }, {
        onPaid: async (res) => {
          setVerifying(true); // full-screen "confirming" overlay + back-button guard until we have an answer
          const ok = await verifyPayment(d.id, res);
          if (ok) toast.success("Payment successful!"); else toast.error("We're still confirming your payment. Check My Orders in a minute.");
          setVerifying(false);
          router.replace(ok ? `/order-success/${d.id}` : `/orders/${d.id}`);
        },
        onDismiss: () => { toast.error("Payment not completed. Your order is saved — you can pay from My Orders."); router.replace(`/orders/${d.id}`); },
        onFailed: () => toast.error("Payment failed. You can try again from your order page."),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start payment");
      router.replace(`/orders/${d.id}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {verifying && (
        <div role="alertdialog" aria-live="assertive" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-white/95 p-6 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-lg font-bold">Confirming your payment…</p>
          <p className="max-w-xs text-sm text-gray-600">Please don't press Back, refresh or close this page. This takes only a few seconds.</p>
        </div>
      )}
      <form onSubmit={place} noValidate className="card space-y-3 p-5 md:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Delivery details</h1>
          <span className="flex items-center gap-2 text-xs text-gray-500">Cancellation policy <InfoTip title="Cancellation policy" lines={CANCEL_POLICY} /></span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(([k, label, type]) => (
            <label key={k} className="text-sm font-medium">{label}<Req />
              <input className={`input mt-1 ${errs[k] ? "!border-red-500" : ""}`} type={type || "text"} value={form[k] || ""}
                inputMode={k === "phone" || k === "pincode" ? "numeric" : undefined}
                maxLength={k === "phone" ? 10 : k === "pincode" ? 6 : ADDRESS_LIMITS[k as keyof typeof ADDRESS_LIMITS][1]}
                onChange={(e) => setForm({ ...form, [k]: k === "phone" || k === "pincode" ? e.target.value.replace(/\D/g, "") : e.target.value })}
                onBlur={() => setErrs((x) => { const { [k]: _, ...rest } = x; const m = validateAddress(cleanAddress(form))[k]; return m ? { ...rest, [k]: m } : rest; })} />
              <FieldError msg={errs[k]} />
            </label>
          ))}
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {([["cod", "💵 Cash on Delivery", "Pay when your order arrives."], ["online", "💳 Pay Online", "UPI, cards, netbanking (Razorpay)."]] as const).map(([k, t, sub]) => (
            <label key={k} className={`cursor-pointer rounded-lg border p-3 ${method === k ? "border-brand-600 bg-brand-50" : "border-gray-200"}`}>
              <input type="radio" name="pay" className="mr-2" checked={method === k} onChange={() => setMethod(k)} /><b>{t}</b><span className="block pl-5 text-xs text-gray-600">{sub}</span>
            </label>
          ))}
        </div>
        <p className="flex items-center gap-2 text-xs text-gray-600"><InfoTip title="Cancellation policy" lines={CANCEL_POLICY} /> Cancel while “Placed”. Once “Confirmed”, no cancellation or returns.</p>
        <div className="h-16 md:hidden" aria-hidden />
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          {problems.length > 0 && (
            <div role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-700">
              {problems.map((p) => <p key={p}>{p}</p>)}
              <a href="/cart" className="font-semibold underline">Update your cart</a>
            </div>
          )}
          <button className="btn-primary w-full" disabled={busy || problems.length > 0}>{busy ? "Placing order…" : `${method === "online" ? "Pay & Place Order" : "Place Order (COD)"} · ${inr(total)}`}</button>
        </div>
      </form>
      <div className="card h-fit space-y-2 p-5">
        <h2 className="font-bold">Items</h2>
        {checkoutItems.map((i) => (
          <div key={`${i.id}|${i.size}`} className="flex justify-between text-sm"><span>{i.title}{i.size && ` (${i.size})`} × {i.qty}</span><span>{inr(i.price * i.qty)}</span></div>
        ))}
        <hr /><div className="flex justify-between font-bold"><span>Total</span><span>{inr(total)}</span></div>
      </div>
    </div>
  );
}
export default function Page() { return <Suspense><Checkout /></Suspense>; }
