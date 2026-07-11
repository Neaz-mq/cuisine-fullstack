"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { useCart } from "@/context/CartContext";

// ---------------------------------------------------------------------------
// Order Again
//
// Deliberately re-adds items using the menu item's CURRENT title/price/
// image/availability (passed in via props from the server component that
// already fetched order.items.menuItem), not the historical price frozen
// on the OrderItem at the time of purchase. Prices can change and items
// can be taken off the menu since the order was placed — re-ordering
// should reflect what the customer would actually pay and receive today,
// same as if they'd added it from the live menu.
// ---------------------------------------------------------------------------

export type OrderAgainItem = {
  menuItemId: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  isAvailable: boolean;
};

export default function OrderAgainButton({ items }: { items: OrderAgainItem[] }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [isAdding, setIsAdding] = useState(false);

  const availableItems = items.filter((item) => item.isAvailable);
  const unavailableCount = items.length - availableItems.length;

  const handleOrderAgain = () => {
    if (availableItems.length === 0) {
      toast.error("None of these items are on the menu anymore.");
      return;
    }

    setIsAdding(true);

    availableItems.forEach((item) => {
      addToCart({
        id: item.menuItemId,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl ?? undefined,
      });
    });

    if (unavailableCount > 0) {
      toast.warning(
        `${unavailableCount} item${unavailableCount > 1 ? "s" : ""} from this order ${
          unavailableCount > 1 ? "are" : "is"
        } no longer available and ${unavailableCount > 1 ? "were" : "was"} skipped.`
      );
    } else {
      toast.success("Items added to your cart.");
    }

    router.push("/carts");
  };

  return (
    <button
      type="button"
      onClick={handleOrderAgain}
      disabled={isAdding}
      className="text-xs font-medium text-[#FF4C15] hover:underline disabled:opacity-50"
    >
      Order again →
    </button>
  );
}