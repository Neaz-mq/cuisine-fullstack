"use client";

import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useCart } from "@/context/CartContext";
import type { ComboDeal } from "@/lib/combo-pricing";

/**
 * Adds every component of a combo to the cart as ordinary lines, then opens
 * the cart — same flow as "Order again". Cart lines are keyed by MenuItem id,
 * so checkout needs no combo awareness. Prices here are for display only;
 * the server re-prices each line (menu price + live offer) at checkout.
 */
export default function ComboOrderButton({
  combo,
  className,
}: {
  combo: Pick<ComboDeal, "name" | "lines">;
  className?: string;
}) {
  const router = useRouter();
  const { addToCart } = useCart();

  const handleClick = () => {
    for (const line of combo.lines) {
      addToCart({
        id: line.id,
        title: line.title,
        price: line.price,
        quantity: line.quantity,
        imageUrl: line.imageUrl ?? undefined,
      });
    }
    toast.success(`${combo.name} added to your cart.`);
    router.push("/carts");
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      Order Now
    </button>
  );
}