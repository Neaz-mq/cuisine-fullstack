"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import OfferModal from "./OfferModal";
import type { MoneyFormat, OfferProduct } from "./types";

/**
 * "+ Add Offer" on each row of "Add an Offer to a Product" — Figma: small
 * gradient pill. Opens the offer form with this product already chosen.
 */
export default function AddOfferButton({
  product,
  money,
}: {
  product: OfferProduct;
  money: MoneyFormat;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Add an offer to ${product.title}`}
        // Below 480px only the "+" shows (a 36px circle), so the dish name
        // keeps room — with the words it was cut down to "Marg…".
        className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] font-sora text-[14px] font-normal leading-none text-white transition-opacity hover:opacity-90 min-[480px]:h-10 min-[480px]:w-auto min-[480px]:px-4 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
      >
        <Plus className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span className="hidden min-[480px]:inline">Add Offer</span>
      </button>
      <OfferModal
        open={open}
        onClose={() => setOpen(false)}
        mode={{ kind: "add", product }}
        money={money}
      />
    </>
  );
}
