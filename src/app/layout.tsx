import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Poppins } from "next/font/google";
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
      className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} h-full antialiased`}
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
