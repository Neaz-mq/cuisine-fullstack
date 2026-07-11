import { Suspense } from "react";
import Container from "@/components/Container";
import DineInClient from "./DineInClient";

/**
 * src/app/(main)/dine-in/page.tsx
 *
 * QR-scan landing route. A table's QR code (see admin/tables ->
 * QrDownloadButton) encodes `${origin}/dine-in?table=<tableId>`. This page
 * validates that table id, stores it in TableOrderContext (sessionStorage),
 * and redirects into the normal menu at /order — from there on it's the
 * same browsing/cart flow as a regular delivery order, just with
 * dine-in-aware checkout (see Carts.tsx).
 *
 * Note: /order (menu browsing) and /table (reservations) were both already
 * taken by other pages, so /dine-in is the QR landing route.
 *
 * useSearchParams() requires a Suspense boundary around the client
 * component that uses it, or Next.js errors at build time — hence this
 * thin server wrapper.
 */
export default function DineInLandingPage() {
  return (
    <Container>
      <Suspense
        fallback={
          <div className="min-h-[60vh] flex items-center justify-center px-4">
            <p className="text-sm text-gray-500">Setting up your table…</p>
          </div>
        }
      >
        <DineInClient />
      </Suspense>
    </Container>
  );
}
