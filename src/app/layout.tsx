import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { CartProvider } from "@/context/CartContext";
import Navbar from "@/components/Navbar";
import TopBar from "@/components/TopBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cuisine",
  description: "Restaurant ordering app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <CartProvider>
            <div className="flex flex-col min-h-screen">
              <TopBar />
              <div className="flex flex-1">
                <div className="sticky top-44 h-fit w-20 z-40">
                  <Navbar />
                </div>
                <div className="flex-1 ml-20">{children}</div>
              </div>
            </div>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}