import { Suspense } from "react";
import GiftCardPurchase from "./GiftCardPurchase";

export default function GiftCardsPage() {
  return (
    <Suspense fallback={null}>
      <GiftCardPurchase />
    </Suspense>
  );
}
