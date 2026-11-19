import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
export const metadata: Metadata = { title: "Shipping & cancellation — enteCart.kerala", description: "Delivery times, order cancellation and return policy at enteCart.kerala.", alternates: { canonical: "/shipping-cancellation" } };

export default function ShippingCancellation() {
  return (
    <InfoPage title="Shipping & cancellation" intro="How your order gets to you — and when you can cancel it.">
      <section><h2>Delivery</h2>
        <ul><li>We deliver across Kerala to the address you give at checkout.</li><li>Orders are usually confirmed within one working day and delivered within <b>3–7 working days</b>, depending on your location.</li><li>Delivery is currently <b>free</b>.</li><li>Please keep your phone reachable — the delivery partner may call before arriving.</li></ul></section>
      <section><h2>Payment</h2><ul><li><b>Pay online</b> with UPI, cards or netbanking, securely through Razorpay.</li><li><b>Cash on Delivery:</b> keep the exact amount ready and pay when you receive your order. Check the parcel before you pay.</li></ul></section>
      <section><h2>Cancellation</h2>
        <ul><li>You can cancel your order from <b>My Orders</b> while its status is <b>“Placed”</b>.</li><li>Once the order is <b>“Confirmed”</b>, it <b>can no longer be cancelled</b>.</li><li>Cancelled Cash on Delivery orders are not charged — you pay nothing.</li><li><b>Paid online?</b> Cancelling a “Placed” order refunds the <b>full amount automatically</b> to your original payment method (UPI, card or bank). It usually shows up in 5–7 working days. Problems? <a className="font-semibold text-brand-700 hover:underline" href="/contact">Contact us</a>.</li></ul></section>
      <section><h2>Returns</h2><p><b>Returns are not available.</b> Please check your parcel when it arrives, before you pay.</p></section>
      <section><h2>Need help?</h2><p>Reach us from the <a className="font-semibold text-brand-700 hover:underline" href="/contact">contact page</a>.</p></section>
    </InfoPage>
  );
}
