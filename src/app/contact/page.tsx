import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getSettings } from "@/lib/settings";
export const metadata: Metadata = { title: "Contact us — enteCart.kerala", description: "Contact enteCart.kerala by phone, WhatsApp or email for help with your order.", alternates: { canonical: "/contact" } };
export const dynamic = "force-dynamic";

export default async function Contact() {
  const s = await getSettings();
  const wa = s.shop_whatsapp ? `https://wa.me/${s.shop_whatsapp.length === 10 ? "91" + s.shop_whatsapp : s.shop_whatsapp}` : "";
  const rows: [string, string, React.ReactNode][] = [
    ["📞", "Phone", s.shop_phone && <a className="font-semibold text-brand-700 hover:underline" href={`tel:${s.shop_phone}`}>{s.shop_phone}</a>],
    ["💬", "WhatsApp", wa && <a className="font-semibold text-brand-700 hover:underline" href={wa} target="_blank" rel="noopener noreferrer">Chat with us on WhatsApp</a>],
    ["✉️", "Email", s.shop_email && <a className="font-semibold text-brand-700 hover:underline" href={`mailto:${s.shop_email}`}>{s.shop_email}</a>],
    ["📍", "Address", s.shop_address],
    ["🕒", "Opening hours", s.shop_hours],
  ];
  const shown = rows.filter(([, , v]) => v);
  return (
    <InfoPage title="Contact us" intro="We’re happy to help with orders, delivery or anything else.">
      {shown.length ? (
        <ul className="!space-y-4">
          {shown.map(([icon, label, v]) => (
            <li key={label} className="!ml-0 flex list-none items-start gap-3"><span className="text-xl" aria-hidden>{icon}</span><div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p><p>{v}</p></div></li>
          ))}
        </ul>
      ) : <p>Our contact details will be available here soon. In the meantime, please check your order page for updates.</p>}
      <section><h2>Order help</h2><p>Have your <b>order number</b> ready (find it under “My Orders”) — it helps us answer faster.</p></section>
    </InfoPage>
  );
}
