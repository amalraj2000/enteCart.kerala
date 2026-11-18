import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
export const metadata: Metadata = { title: "FAQ — enteCart.kerala" };

const FAQ: [string, string][] = [
  ["How do I place an order?", "Add products to your cart (or tap Buy Now), log in or register with your phone number or Gmail, enter your delivery address and place the order. You’ll see a confirmation straight away."],
  ["What payment methods do you accept?", "Cash on Delivery only. You pay in cash when your order is delivered — there’s nothing to pay online."],
  ["Do I need an account?", "Yes — a quick registration with your phone number or Gmail lets you place orders, track them under “My Orders”, and save your address and wishlist."],
  ["How can I track my order?", "Open “My Orders” after logging in. Each order shows its status: Placed, Confirmed, Shipped or Delivered."],
  ["Can I cancel my order?", "Yes — but only while the order status is “Placed”. Open My Orders, choose the order and tap Cancel order. Once we confirm the order (status “Confirmed”), it can no longer be cancelled."],
  ["Which areas do you deliver to?", "We deliver across Kerala. Enter your full address and pincode at checkout and we’ll take it from there."],
  ["How long does delivery take?", "Delivery times depend on your location — see our Shipping & cancellation page for details."],
  ["Do you accept returns?", "No — returns are not available. Please check your parcel when it arrives, before you pay. If something looks wrong, tell the delivery person and contact us."],
  ["How do I change my address or password?", "Log in, then open your profile menu → Profile settings. You can edit your address and change your password there."],
];

export default function Faq() {
  return (
    <InfoPage title="Frequently asked questions" intro="Quick answers to the things people ask us most.">
      <div className="!space-y-2">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group rounded-lg border border-gray-200 px-4 py-3 open:bg-brand-50/50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-gray-900">{q}<span className="text-xl text-brand-600 transition group-open:rotate-45" aria-hidden>+</span></summary>
            <p className="mt-2 text-gray-700">{a}</p>
          </details>
        ))}
      </div>
    </InfoPage>
  );
}
