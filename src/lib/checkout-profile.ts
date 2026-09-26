import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * src/lib/checkout-profile.ts
 *
 * What checkout can fill in for a signed-in customer, and in what order
 * of preference. Pure — the route (api/account/checkout-profile) does
 * the database reads, this decides what to hand back.
 *
 *   Name  — the account name (Google gives it at sign-in); the last
 *           order's name only if the account has none.
 *   Email — always the account email: it's where receipts and the
 *           order-status emails go, and it's already verified by sign-in.
 *   Phone — the last delivery order's number first (the one the rider
 *           actually called), else the number saved at registration.
 *           Google accounts have no phone until the first order.
 *   Address — the last delivery order's address, if there is one.
 */

export type CheckoutProfile = {
  fullName: string;
  email: string;
  /** `countryCode` is ISO ("BD") when known; `countryName` as checkout stored it. */
  phone: { number: string; countryCode: string | null; countryName: string | null } | null;
  address: {
    address: string;
    apartment: string;
    city: string;
    state: string;
    zip: string;
  } | null;
};

type UserRow = { name: string | null; email: string; phone: string | null };
type LastOrderRow = {
  firstName: string;
  lastName: string;
  phone: string;
  country: string | null;
  address: string | null;
  apartment: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
} | null;

/** "+8801785286936" → { number: "1785286936", countryCode: "BD" }. */
export function splitE164(e164: string): { number: string; countryCode: string | null } | null {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return null;
  return { number: String(parsed.nationalNumber), countryCode: parsed.country ?? null };
}

export function buildCheckoutProfile(user: UserRow, lastOrder: LastOrderRow): CheckoutProfile {
  const orderName = lastOrder ? [lastOrder.firstName, lastOrder.lastName].filter(Boolean).join(" ").trim() : "";

  let phone: CheckoutProfile["phone"] = null;
  if (lastOrder?.phone) {
    // Checkout stores what the customer typed plus the country name — the
    // form wants exactly that back. An E.164 number ("+880…") is split so
    // the country picker and the number box each get their part.
    const split = lastOrder.phone.startsWith("+") ? splitE164(lastOrder.phone) : null;
    phone = split
      ? { ...split, countryName: lastOrder.country }
      : { number: lastOrder.phone, countryCode: null, countryName: lastOrder.country };
  } else if (user.phone) {
    const split = splitE164(user.phone);
    if (split) phone = { ...split, countryName: null };
  }

  const hasAddress = Boolean(lastOrder?.address?.trim() || lastOrder?.city?.trim());

  return {
    fullName: user.name?.trim() || orderName,
    email: user.email,
    phone,
    address:
      lastOrder && hasAddress
        ? {
            address: lastOrder.address ?? "",
            apartment: lastOrder.apartment ?? "",
            city: lastOrder.city ?? "",
            state: lastOrder.state ?? "",
            zip: lastOrder.zip ?? "",
          }
        : null,
  };
}
