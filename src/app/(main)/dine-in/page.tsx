import { Suspense } from "react";
import Container from "@/components/Container";
import DineInClient from "./DineInClient";

/**
 * src/app/(main)/dine-in/page.tsx
 *
 * QR-scan landing route. A table's QR code (see admin/tables ->
 * QrDownloadButton) encodes `${origin}/dine-in?table=<tableId>`. This page
 * validates that table id, stores it in TableOrderContext (sessionStorage),
 * and redirects into the normal menu at /menu — from there on it's the
 * same browsing/cart flow as a regular delivery order, just with
 * dine-in-aware checkout (see Carts.tsx).
 *
 * Note: /table (reservations) was already taken by another page, so
 * /dine-in is the QR landing route. The customer-facing menu is /menu —
 * NOT /order, which is an older, different page.
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