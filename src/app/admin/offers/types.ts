/**
 * Plain, serialisable shapes the server page hands to the client pieces of
 * /admin/offers (modal, card buttons). Money is already a number here — it
 * is only shown and used for the "New Price" preview; the server works the
 * real price out again when the offer is saved and at checkout.
 */
export type OfferProduct = {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
};

export type EditableOffer = {
  id: string;
  product: OfferProduct;
  type: "PERCENT" | "FIXED";
  value: number;
  audience: "ALL" | "MEMBERS";
  /** "2026-08-01", in the restaurant's time zone. */
  startDate: string;
  /** The last day it runs, or null for no end date. */
  endDate: string | null;
};

export type MoneyFormat = {
  currency: string;
  minorUnits: number;
};
