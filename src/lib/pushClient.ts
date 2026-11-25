"use client";

/** Stops phone notifications for this device (used on logout so the next person on a shared phone isn't sent the previous person's alerts). */
export async function pushUnsubscribe() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (!sub) return;
    await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  } catch { /* nothing to do */ }
}

