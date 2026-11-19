import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { getSettings } from "@/lib/settings";
export const metadata: Metadata = { title: "About us — enteCart.kerala", description: "Learn about enteCart.kerala — Kerala's friendly online store with handpicked products delivered to your doorstep.", alternates: { canonical: "/about" } };
export const dynamic = "force-dynamic";

export default async function About() {
  const s = await getSettings();
  return (
    <InfoPage title="About enteCart.kerala" intro={s.shop_about || "A friendly Kerala online store — shop local, shop Kerala."}>
      <section><h2>Our story</h2><p>enteCart.kerala (“my cart” in Malayalam style) was built to make shopping simple for families across Kerala: browse handpicked products and order in a minute, delivered to your door.</p></section>
      <section><h2>What we stand for</h2>
        <ul><li><b>Quality you can trust.</b> Every product is picked and checked before it is listed.</li><li><b>Local first.</b> We love Kerala’s weavers, farmers and makers, and feature them wherever we can.</li><li><b>Honest service.</b> Clear prices and clear delivery.</li></ul></section>
      <section><h2>Get in touch</h2><p>Questions or feedback? Visit our <a className="font-semibold text-brand-700 hover:underline" href="/contact">contact page</a> — we’d love to hear from you.</p></section>
    </InfoPage>
  );
}
