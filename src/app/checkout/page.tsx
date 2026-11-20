"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/Providers";
import { toast } from "@/components/Toaster";
import { discountPct, inr } from "@/lib/types";
import Img from "@/components/Img";
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

/** Two-step progress bar: 1 Review → 2 Payment. */
function Steps({ step }: { step: 1 | 2 }) {
  const dot = (n: 1 | 2, label: string) => (
    <div className="flex flex-col items-center gap-1">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold ${step > n ? "border-brand-600 bg-brand-600 text-white" : step === n ? "border-brand-600 bg-white text-brand-700" : "border-gray-300 bg-white text-gray-400"}`}>{step > n ? "✓" : n}</span>
      <span className={`text-xs font-medium ${step >= n ? "text-brand-700" : "text-gray-400"}`}>{label}</span>
    </div>
  );
  return (
    <div className="mx-auto mb-6 flex max-w-sm items-start">
      {dot(1, "Review")}
      <div className={`mx-2 mt-4 h-0.5 flex-1 ${step > 1 ? "bg-brand-600" : "bg-gray-200"}`} />
      {dot(2, "Payment")}
    </div>
  );
}

function Checkout() {
  const { checkoutItems, user, openAuth, clearCart, resetBuyNow, authReady, syncStock } = useApp();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<Record<string, string>>({ state: "Kerala" });
  const [editAddr, setEditAddr] = useState(false);
  const [errs, setErrs] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const verifyingRef = useRef(false);
  const placing = useRef(false);
  const [method, setMethod] = useState<"cod" | "online">("cod");
  const [loaded, setLoaded] = useState(false);
  const [placed, setPlaced] = useState<"cod" | "online" | null>(null); // the order exists: show a confirmation instead of a flash of the emptied cart
  const [stockOk, setStockOk] = useState<boolean | null>(null); // null = still checking live stock, false = couldn't check
  const [onlineOk, setOnlineOk] = useState(false); // owner's switch (Admin → Payments) + Razorpay configured
  useEffect(() => { fetch("/api/payments/status", { cache: "no-store" }).then((r) => r.json()).then((d) => { setOnlineOk(!!d.online); if (!d.online) setMethod("cod"); }).catch(() => {}); }, []);

  // Prefill: the saved address (the server falls back to the address of the last order) in ONE request. It starts the moment the page opens,
  // in parallel with the login check, instead of waiting for it — and the old second request (the whole order history) is gone.
  const addrPre = useRef<Promise<{ address: Record<string, string> | null } | null> | null>(null);
  const getAddress = () => fetch("/api/auth/address", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  useEffect(() => { addrPre.current = getAddress(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user) return;
    const accountName = user.name || "";
    (async () => {
      let a = await addrPre.current; addrPre.current = null;
      if (!a) a = await getAddress(); // the early request ran before login finished (or failed): ask again now
      const last = a?.address;
      setForm((f) => ({
          customer_name: accountName || last?.customer_name || "",
          phone: last?.phone || user.phone || "",
          house_name: last?.house_name || "", street_name: last?.street_name || "", city: last?.city || "",
          state: last?.state || "Kerala", pincode: last?.pincode || "",
          ...Object.fromEntries(Object.entries(f).filter(([k, v]) => v && k !== "state")),
      }));
    })().finally(() => setLoaded(true));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Once the saved address has loaded: if it's incomplete (new customer), open the address form straight away.
  useEffect(() => { if (loaded) setEditAddr(!!firstError(validateAddress(cleanAddress(form)))); }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  // Page refreshed / reopened while an online payment was in progress: the order already exists (unpaid), so go to it
  // (its page has "Pay now") instead of showing an empty checkout. Never place a second order.
  useEffect(() => {
    try { const id = sessionStorage.getItem("ek_pay_order"); if (id && /^[a-z0-9]{10}$/.test(id)) { sessionStorage.removeItem("ek_pay_order"); router.replace(`/orders/${id}`); } } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // While the order request or the payment window is running, warn before a refresh/close.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  useEffect(() => { syncStock().then((ok) => setStockOk(ok)); }, []); // eslint-disable-line react-hooks/exhaustive-deps — re-check live stock when checkout opens

  // Step 2 gets its own history entry, so the browser Back button returns to step 1 instead of leaving checkout.
  useEffect(() => {
    const onPop = () => { if (!verifyingRef.current) setStep(1); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // While we confirm a payment, stop accidental exits: warn on close/refresh and swallow the Back button.
  useEffect(() => {
    verifyingRef.current = verifying;
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
  const mrp = checkoutItems.reduce((s, i) => s + Math.max(i.price, i.original_price || 0) * i.qty, 0);
  const saved = mrp - total;
  const count = checkoutItems.reduce((s, i) => s + i.qty, 0);

  if (placed) return (
    <div className="card mx-auto max-w-md p-10 text-center" role="status" aria-live="polite">
      {placed === "cod"
        ? <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl text-brand-700" aria-hidden>✓</span>
        : <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" aria-hidden />}
      <h1 className="mt-4 text-2xl font-bold text-brand-700">{placed === "cod" ? "Order placed!" : "Order created"}</h1>
      <p className="mt-2 text-gray-600">{placed === "cod" ? "Taking you to your order…" : "Complete your payment in the secure window."}</p>
    </div>
  );
  if (!checkoutItems.length) return <p className="card p-8 text-center text-gray-600">Nothing to checkout. <a className="text-brand-700 underline" href="/">Go shopping</a></p>;
  if (authReady && !user)
    return <div className="card p-8 text-center"><p className="mb-3">Please log in to place your order.</p><button className="btn-primary" onClick={() => openAuth()}>Login / Register</button></div>;

  /** Step 1 → 2: stock and address must be fine before the customer gets to pick how to pay. */
  function goPayment() {
    if (stockOk !== true) return toast.error(stockOk === false ? "We couldn't check live stock. Check your connection and refresh." : "Checking stock… one moment");
    if (problems.length) return toast.error(problems[0]);
    const ve = validateAddress(cleanAddress(form)); // same rules the server enforces
    setErrs(ve);
    if (firstError(ve)) { setEditAddr(true); return toast.error("Please complete your delivery address"); }
    setEditAddr(false);
    history.pushState({ step: 2 }, "", location.href);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function backToReview() { if (history.state?.step === 2) history.back(); else setStep(1); }

  async function place() {
    if (placing.current) return; // a second click/tap before the button re-renders must not create a second order
    if (stockOk !== true) return toast.error(stockOk === false ? "We couldn't check live stock. Check your connection and refresh." : "Checking stock… one moment");
    if (problems.length) return toast.error(problems[0]);
    const clean = cleanAddress(form);
    const ve = validateAddress(clean);
    setErrs(ve);
    if (firstError(ve)) { setStep(1); setEditAddr(true); return toast.error("Please fix your delivery address"); }
    placing.current = true;
    setBusy(true);
    const r = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...clean, payment_method: method, items: checkoutItems.map((i) => ({ id: i.id, size: i.size, qty: i.qty })) }),
    }).catch(() => null);
    if (!r) { placing.current = false; setBusy(false); return toast.error("Network problem — check your connection and try again. (If you were charged, see My Orders.)"); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { placing.current = false; setBusy(false); return toast.error(d.error || "Could not place order"); }
    // The order exists now (stock reserved). Buy Now leaves the cart untouched; a normal checkout empties it.
    const finish = () => { if (new URLSearchParams(location.search).get("buynow")) resetBuyNow(); else clearCart(); };
    if (method === "cod") {
      // Show the confirmation first, THEN empty the cart and leave (emptying it first flashed "Nothing to checkout" until the next page loaded).
      // The button stays disabled until we have navigated, so it can't be pressed twice.
      setPlaced("cod"); toast.success("Order placed successfully!"); finish(); return router.replace(`/order-success/${d.pid}`);
    }
    setPlaced("online"); // the cart is emptied below, so keep showing something sensible behind the payment window
    const clearPending = () => { try { sessionStorage.removeItem("ek_pay_order"); } catch {} };
    try { sessionStorage.setItem("ek_pay_order", String(d.pid)); } catch {}
    try {
      finish(); // the order exists; from here the customer is either paying or can resume from My Orders
      await openPayment(d.id, { name: clean.customer_name, contact: clean.phone }, {
        onPaid: async (res) => {
          clearPending();
          setVerifying(true); // full-screen "confirming" overlay + back-button guard until we have an answer
          const ok = await verifyPayment(d.id, res);
          if (ok) toast.success("Payment successful!"); else toast.error("We're still confirming your payment. Check My Orders in a minute.");
          setVerifying(false);
          router.replace(ok ? `/order-success/${d.pid}` : `/orders/${d.pid}`);
        },
        onDismiss: () => { clearPending(); toast.error("Payment not completed. Your order is saved — you can pay from My Orders."); router.replace(`/orders/${d.pid}`); },
        onFailed: () => toast.error("Payment failed. You can try again from your order page."),
      });
    } catch (err) {
      clearPending();
      toast.error(err instanceof Error ? err.message : "Could not start payment");
      router.replace(`/orders/${d.pid}`);
    } finally { setBusy(false); }
  }

  const addressCard = (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><span aria-hidden>📍</span> Delivery address</h2>
        {step === 1 && !editAddr && <button type="button" className="text-sm font-bold text-brand-700 hover:underline" onClick={() => setEditAddr(true)}>CHANGE</button>}
        {step === 2 && <button type="button" className="text-sm font-bold text-brand-700 hover:underline" onClick={backToReview}>CHANGE</button>}
      </div>
      {step === 1 && editAddr ? (
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
      ) : (
        <div className="text-sm leading-relaxed text-gray-700">
          <p className="text-base font-semibold text-gray-900">{form.customer_name}</p>
          <p>{form.house_name}, {form.street_name}, {form.city}, {form.state} - {form.pincode}</p>
          <p className="mt-1 font-medium">📞 {form.phone}</p>
        </div>
      )}
    </section>
  );

  const priceDetails = (
    <section className="card h-fit space-y-2 p-5 text-sm">
      <h2 className="text-lg font-bold">Price details <span className="text-sm font-normal text-gray-500">({count} item{count === 1 ? "" : "s"})</span></h2>
      <div className="flex justify-between"><span className="text-gray-600">{saved > 0 ? "Original price" : "Product price"}</span><span>{inr(mrp)}</span></div>
      {saved > 0 && <div className="flex justify-between text-green-700"><span>Total discount</span><span>− {inr(saved)}</span></div>}
      <div className="flex justify-between"><span className="text-gray-600">Delivery</span><span className="font-medium text-brand-700">Free</span></div>
      <hr />
      <div className="flex justify-between text-base font-bold"><span>Order total</span><span>{inr(total)}</span></div>
      {saved > 0 && <p className="rounded-lg bg-green-50 p-2.5 text-center text-sm font-semibold text-green-700">🎉 Yay! Your total discount is {inr(saved)}</p>}
    </section>
  );

  return (
    <div>
      {verifying && (
        <div role="alertdialog" aria-live="assertive" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-white/95 p-6 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-lg font-bold">Confirming your payment…</p>
          <p className="max-w-xs text-sm text-gray-600">Please don't press Back, refresh or close this page. This takes only a few seconds.</p>
        </div>
      )}
      <Steps step={step} />

      <div className="grid items-start gap-6 md:grid-cols-3">
        <div className="space-y-5 md:col-span-2">
          {step === 1 ? (
            <>
              <section className="card overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b bg-gray-50 px-5 py-3">
                  <h2 className="font-bold">Product details</h2>
                  <Link href="/cart" className="text-sm font-bold text-brand-700 hover:underline">EDIT CART</Link>
                </div>
                <p className="flex items-center gap-2 border-b px-5 py-2.5 text-sm text-gray-700"><span aria-hidden>🚚</span> Estimated delivery in <b>3–7 working days</b></p>
                <ul className="divide-y">
                  {checkoutItems.map((i) => {
                    const off = discountPct(i.price, i.original_price);
                    return (
                      <li key={`${i.id}|${i.size}`} className="flex gap-4 p-4">
                        <Img src={i.image_url} alt={i.title} sizes="80px" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-medium">{i.title}</p>
                          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm">
                            <span className="font-bold">{inr(i.price)}</span>
                            {off > 0 && <><span className="text-xs text-gray-400 line-through">{inr(Number(i.original_price))}</span><span className="text-xs font-semibold text-green-700">{off}% off</span></>}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">{i.size && <>Size: {i.size} <span className="mx-1">·</span></>}Qty: {i.qty}</p>
                        </div>
                        <p className="shrink-0 font-semibold">{inr(i.price * i.qty)}</p>
                      </li>
                    );
                  })}
                </ul>
              </section>
              {addressCard}
              <p className="flex items-center gap-2 text-xs text-gray-600"><InfoTip title="Cancellation policy" lines={CANCEL_POLICY} /> Cancel while “Placed”. Once “Confirmed”, no cancellation or returns.</p>
            </>
          ) : (
            <>
              <section className="card p-5">
                <h2 className="mb-3 text-lg font-bold">Select payment method</h2>
                <div className="space-y-3">
                  {([
                    ["online", "💳", "Pay Online", "UPI, cards, netbanking, wallets — secured by Razorpay"],
                    ["cod", "💵", "Cash on Delivery", "Pay in cash when your order arrives"],
                  ] as const).filter(([k]) => k !== "online" || onlineOk).map(([k, icon, t, sub]) => (
                    <label key={k} className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition ${method === k ? "border-brand-600 bg-brand-50" : "border-gray-200 hover:border-brand-200"}`}>
                      <span className="text-2xl" aria-hidden>{icon}</span>
                      <span className="min-w-0 flex-1"><span className="block font-semibold">{t}</span><span className="block text-xs text-gray-600">{sub}</span></span>
                      <input type="radio" name="pay" className="h-5 w-5 accent-brand-600" checked={method === k} onChange={() => setMethod(k)} />
                    </label>
                  ))}
                </div>
              </section>
              {addressCard}
            </>
          )}
        </div>

        <div className="space-y-4">
          {priceDetails}
          {problems.length > 0 && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-700">
              {problems.map((p) => <p key={p}>{p}</p>)}
              <a href="/cart" className="font-semibold underline">Update your cart</a>
            </div>
          )}
          <div className="h-16 md:hidden" aria-hidden />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            {step === 1 ? (
              <>
                <p className="mb-1.5 hidden text-center text-xs text-gray-500 md:block">Clicking “Continue” will not deduct any money</p>
                <button className="btn-primary w-full" onClick={goPayment} disabled={!loaded || stockOk !== true || problems.length > 0}>Continue · {inr(total)}</button>
              </>
            ) : (
              <div className="space-y-2">
                <button className="btn-primary w-full" onClick={place} disabled={busy || stockOk !== true || problems.length > 0}>
                  {busy ? "Placing order…" : method === "online" ? `Pay ${inr(total)} & Place Order` : `Place Order · ${inr(total)}`}
                </button>
                <button type="button" className="w-full text-center text-sm font-medium text-gray-600 hover:text-brand-700" onClick={backToReview} disabled={busy}>← Back to review</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default function Page() { return <Suspense><Checkout /></Suspense>; }
