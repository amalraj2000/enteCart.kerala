const ITEMS = [
  ["💵", "Cash on Delivery", "Pay when it arrives"],
  ["🚚", "Delivery across Kerala", "Right to your doorstep"],
  ["📦", "Track your order", "Live status in My Orders"],
  ["✅", "Genuine products", "Handpicked & quality checked"],
];

export default function TrustStrip() {
  return (
    <ul className="mb-8 grid grid-cols-2 gap-3 rounded-2xl border border-brand-100 bg-white p-4 lg:grid-cols-4">
      {ITEMS.map(([icon, title, sub]) => (
        <li key={title} className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl" aria-hidden>{icon}</span>
          <div className="min-w-0"><p className="text-sm font-semibold leading-tight">{title}</p><p className="text-xs text-gray-500">{sub}</p></div>
        </li>
      ))}
    </ul>
  );
}
