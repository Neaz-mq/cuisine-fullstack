"use client";

import { Plus } from "lucide-react";
import { toast } from "react-toastify";
import { useCart } from "@/context/CartContext";
import { SMALL_PRIMARY } from "./ui";

/**
 * "Add" on a favourite dish in the customer panel.
 *
 * The price passed in is only for the cart's running subtotal — checkout
 * re-prices every line on the server (api/checkout/quote), same as when
 * a dish is added from the menu.
 */
export default function AddDishButton({
  dish,
}: {
  dish: { id: string; title: string; price: number; imageUrl: string | null; description?: string };
}) {
  const { addToCart } = useCart();

  return (
    <button
      type="button"
      onClick={() => {
        addToCart({
          id: dish.id,
          title: dish.title,
          price: dish.price,
          quantity: 1,
          imageUrl: dish.imageUrl ?? undefined,
          description: dish.description,
        });
        toast.success(`${dish.title} added to cart`);
      }}
      className={SMALL_PRIMARY}
      aria-label={`Add ${dish.title} to cart`}
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
      Add
    </button>
  );
}
