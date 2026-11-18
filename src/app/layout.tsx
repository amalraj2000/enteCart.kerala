import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Toaster from "@/components/Toaster";
import AuthModal from "@/components/AuthModal";

export const metadata: Metadata = {
  title: "enteCart.kerala — Shop local, shop Kerala",
  description: "Kerala's friendly online store. Cash on Delivery available.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
          <Footer />
          <AuthModal />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
