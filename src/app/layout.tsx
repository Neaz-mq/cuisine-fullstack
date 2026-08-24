import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Poppins, Frank_Ruhl_Libre, Sora } from "next/font/google";
import "./globals.css";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, Slide } from "react-toastify";
import AuthProvider from "@/components/AuthProvider";
import { CartProvider } from "@/context/CartContext";
import { TableOrderProvider } from "@/context/TableOrderContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});
// Serif display font used for the "Cuisine" logo wordmark and other
// serif headings (see register page) — matches the Figma spec (700
// weight, 30px, 126% line-height, -1% letter-spacing on the logo).
// Self-hosted via next/font like the other fonts here, rather than a
// CSS @import, so there's no extra request to fonts.googleapis.com and
// no layout shift while it loads.
const frankRuhlLibre = Frank_Ruhl_Libre({
  variable: "--font-frank-ruhl",
  subsets: ["latin"],
  // 600 যোগ করা হয়েছে admin sidebar-এর জন্য: Figma-তে active nav item
  // আর user card-এর নাম দুটোই Frank Ruhl Libre SemiBold (600)। তালিকায়
  // না থাকলে ওই weight-এর ফাইলটা download-ই হয় না, browser তখন 500 বা
  // 700-এ ঠেলে দেয় — বা নিজে থেকে মোটা করে আঁকে (synthetic bold),
  // যেটা serif-এ বিশ্রী দেখায়। নীরব ব্যর্থতা: কিছু ভাঙে না, শুধু
  // ফন্টটা Figma-র সাথে মেলে না আর কারণটা ধরা যায় না।
  weight: ["400", "500", "600", "700", "900"],
});
// Body/supporting-text font used for the hero subtext under the "Great
// Food, Delivered With Care" heading (400 weight, 12px, 160%
// line-height, per Figma). Self-hosted via next/font like the others.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// NOTE: swap NEXT_PUBLIC_APP_URL, the description, and openGraph.images
// for your real production domain / copy / branded share image (ideally
// a dedicated 1200x630 PNG/JPG — the Cloudinary photo below is a
// reasonable placeholder, not a designed OG image) before launch.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "Cuisine — Online Restaurant Ordering",
    template: "%s | Cuisine",
  },
  description:
    "Order online for delivery or dine-in, browse our menu, book a table, and send a gift card — all from Cuisine.",
  openGraph: {
    title: "Cuisine — Online Restaurant Ordering",
    description:
      "Order online for delivery or dine-in, browse our menu, book a table, and send a gift card — all from Cuisine.",
    siteName: "Cuisine",
    type: "website",
    images: [
      {
        url: "https://res.cloudinary.com/dxohwanal/image/upload/v1752045017/banner1_p7xkxk.webp",
        width: 1200,
        height: 1200,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cuisine — Online Restaurant Ordering",
    description:
      "Order online for delivery or dine-in, browse our menu, book a table, and send a gift card — all from Cuisine.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${frankRuhlLibre.variable} ${sora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AuthProvider>
          <CartProvider>
            <TableOrderProvider>{children}</TableOrderProvider>
          </CartProvider>
        </AuthProvider>
        <ToastContainer
          position="top-right"
          autoClose={3500}
          newestOnTop
          closeOnClick
          pauseOnHover
          draggable
          theme="colored"
          transition={Slide}
          limit={3}
          toastClassName="cuisine-toast"
        />
      </body>
    </html>
  );
}