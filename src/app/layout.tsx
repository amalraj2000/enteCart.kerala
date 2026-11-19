import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Toaster from "@/components/Toaster";
import AuthModal from "@/components/AuthModal";
import { PwaRegister } from "@/components/Pwa";
import ShopLoader from "@/components/ShopLoader";
import MobileNav from "@/components/MobileNav";
import { SITE_NAME, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "enteCart.kerala — Shop local, shop Kerala",
  description: "Kerala's friendly online store. Handpicked products delivered to your doorstep.",
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN", title: "enteCart.kerala — Shop local, shop Kerala", description: "Kerala's friendly online store. Handpicked products delivered to your doorstep.", images: [{ url: "/logo.png" }] },
  twitter: { card: "summary_large_image" },
  applicationName: "enteCart",
  appleWebApp: { capable: true, title: "enteCart", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#178a49" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
          <Footer />
          <MobileNav />
          <AuthModal />
          <PwaRegister />
          <ShopLoader />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
