import type { Metadata } from "next";
import { Suspense } from "react";
import GiftCardPurchase from "./GiftCardPurchase";

export const metadata: Metadata = {
  title: "Gift Cards",
  description: "Purchase a Cuisine gift card for someone — delivered by email, redeemable on any order.",
};

export default function GiftCardsPage() {
  return (
    <Suspense fallback={null}>
      <GiftCardPurchase />
    </Suspense>
  );
}
