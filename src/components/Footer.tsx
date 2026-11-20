import Link from "next/link";
import { getSettings } from "@/lib/settings";
import FooterSwitch from "./FooterSwitch";
import { InstallApp } from "./Pwa";

const Icon = ({ d, label }: { d: string; label: string }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" role="img" aria-label={label}><path d={d} /></svg>
);
const PATHS = {
  instagram: "M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 3.5A4.5 4.5 0 1112 16.5 4.5 4.5 0 0112 7.5zm0 2A2.5 2.5 0 1012 14.5 2.5 2.5 0 0012 9.5zM17.5 6a1 1 0 110 2 1 1 0 010-2z",
  facebook: "M13.5 22v-8.2h2.8l.5-3.3h-3.3V8.4c0-1 .4-1.7 1.8-1.7H17V3.8C16.6 3.7 15.6 3.6 14.5 3.6c-2.6 0-4.3 1.6-4.3 4.4v2.5H7.5v3.3h2.7V22h3.3z",
  youtube: "M21.6 7.2a2.5 2.5 0 00-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 002.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 001.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 001.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z",
  whatsapp: "M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.8 11.9 11.9 0 004.6 4c1.7.7 2.4.8 3.3.7a2.8 2.8 0 001.8-1.3 2.3 2.3 0 00.2-1.3c-.1-.1-.3-.2-.5-.3z",
};

export default async function Footer() {
  const s = await getSettings();
  const wa = s.shop_whatsapp ? `https://wa.me/${s.shop_whatsapp.length === 10 ? "91" + s.shop_whatsapp : s.shop_whatsapp}` : "";
  const socials = [
    [s.social_instagram, "Instagram", PATHS.instagram], [s.social_facebook, "Facebook", PATHS.facebook],
    [s.social_youtube, "YouTube", PATHS.youtube], [wa, "WhatsApp", PATHS.whatsapp],
  ].filter(([u]) => u) as [string, string, string][];
  const link = "text-gray-600 hover:text-brand-700 hover:underline";

  const full = (
    <footer className="mt-8 border-t bg-white md:mt-12">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-7 px-4 py-7 md:py-10 lg:grid-cols-4 lg:gap-8">
        <div className="col-span-2 lg:col-span-1">
          <p className="text-xl font-extrabold tracking-tight text-brand-700">ente<span className="text-gray-900">Cart</span><span className="text-brand-500">.kerala</span></p>
          <p className="mt-3 text-sm text-gray-600">{s.shop_about || "Kerala's friendly online store. Handpicked products, delivered to your doorstep."}</p>
          {socials.length > 0 && (
            <div className="mt-4 flex gap-2">
              {socials.map(([url, label, d]) => (
                <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-600 hover:text-white"><Icon d={d} label={label} /></a>
              ))}
            </div>
          )}
        </div>
        <nav aria-label="Shop" className="text-sm">
          <h3 className="mb-3 font-bold">Shop</h3>
          <ul className="space-y-2.5">
            <li><Link href="/" className={link}>Home</Link></li><li><Link href="/wishlist" className={link}>My wishlist</Link></li>
            <li><Link href="/orders" className={link}>My orders</Link></li><li><Link href="/cart" className={link}>Cart</Link></li>
          </ul>
        </nav>
        <nav aria-label="Help" className="text-sm">
          <h3 className="mb-3 font-bold">Help</h3>
          <ul className="space-y-2">
            <li><Link href="/faq" className={link}>FAQ</Link></li><li><Link href="/shipping-cancellation" className={link}>Shipping &amp; cancellation</Link></li>
            <li><Link href="/about" className={link}>About us</Link></li><li><Link href="/contact" className={link}>Contact us</Link></li>
            <li><InstallApp className={link} /></li>
          </ul>
        </nav>
        <div className="col-span-2 text-sm lg:col-span-1">
          <h3 className="mb-3 font-bold">Contact</h3>
          <ul className="space-y-2 text-gray-600">
            {s.shop_address && <li>📍 {s.shop_address}</li>}
            {s.shop_phone && <li>📞 <a href={`tel:${s.shop_phone}`} className={link}>{s.shop_phone}</a></li>}
            {s.shop_email && <li>✉️ <a href={`mailto:${s.shop_email}`} className={link}>{s.shop_email}</a></li>}
            {s.shop_hours && <li>🕒 {s.shop_hours}</li>}
            {!s.shop_address && !s.shop_phone && !s.shop_email && <li><Link href="/contact" className={link}>See how to reach us</Link></li>}
          </ul>
        </div>
      </div>
      <div className="border-t px-4 py-3 text-center text-xs text-gray-500">
        <p>© {new Date().getFullYear()} enteCart.kerala · All rights reserved</p>
        <p className="mt-1">A product of <a href="https://softdestiny.vercel.app/" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-700 underline-offset-2 hover:text-brand-700 hover:underline">SoftDestiny Innovation Software Solution</a></p>
      </div>
    </footer>
  );
  const slim = <footer className="border-t bg-white py-6 text-center text-sm text-gray-500">
      <p>© enteCart.kerala · All rights reserved</p>
      <p className="mt-1 text-xs">A product of <a href="https://softdestiny.vercel.app/" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-700 underline-offset-2 hover:text-brand-700 hover:underline">SoftDestiny Innovation Software Solution</a></p>
    </footer>;
  return <FooterSwitch full={full} slim={slim} />;
}
