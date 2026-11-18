/* eslint-disable @typescript-eslint/no-explicit-any */
/** How an order's payment is shown everywhere (customer + admin). */
export function payLabel(o: Record<string, any>) {
  if (o.payment_method !== "online") return { text: "Cash on Delivery", tone: "bg-gray-100 text-gray-700" };
  if (o.payment_status === "Paid") return { text: "Paid online", tone: "bg-green-100 text-green-800" };
  if (o.payment_status === "Refunded") return { text: "Refunded", tone: "bg-blue-100 text-blue-800" };
  if (o.status === "Cancelled") return { text: "Not paid", tone: "bg-gray-100 text-gray-600" };
  return { text: "Payment pending", tone: "bg-red-100 text-red-700" };
}
