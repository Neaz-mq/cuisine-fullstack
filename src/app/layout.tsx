import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, Slide } from "react-toastify";
import AuthProvider from "@/components/AuthProvider";
import { CartProvider } from "@/context/CartContext";
import { TableOrderProvider } from "@/context/TableOrderContext";

/**
 * One font for the whole site: Sora.
 *
 * ⚠️ There used to be five (Poppins for body text, Frank Ruhl Libre for
 * headings, Sora, Geist and Geist Mono). The owner asked for Sora
 * everywhere, so it is the only font downloaded now.
 *
 * Sora is a variable font, so no `weight` list: one file covers every
 * weight from 100 to 800 — `font-semibold`, `font-bold`, `font-extrabold`
 * all come out real, never "fake bold". Self-hosted by next/font, so
 * there is no request to fonts.googleapis.com and no layout shift.
 *
 * The old class names (`font-frank-ruhl`, `font-sans`, `font-mono`)
 * still work — globals.css points them all at Sora, so 100+ components
 * didn't need touching.
 */
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
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
    "Order online for delivery or dine-in, browse our menu, and book a table — all from Cuisine.",
  openGraph: {
    title: "Cuisine — Online Restaurant Ordering",
    description:
      "Order online for delivery or dine-in, browse our menu, and book a table — all from Cuisine.",
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
      "Order online for delivery or dine-in, browse our menu, and book a table — all from Cuisine.",
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
      className={`${sora.variable} h-full antialiased`}
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