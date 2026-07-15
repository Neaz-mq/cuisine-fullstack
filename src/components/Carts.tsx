"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Container from "@/components/Container";
import { useCart } from "@/context/CartContext";
import { useTableOrder } from "@/context/TableOrderContext";
import Select, { SingleValue } from "react-select";
import { toast } from "react-toastify";
import { COUNTRY_OPTIONS, type CountryOption } from "@/data/countries";
import { formatMinutes } from "@/lib/kitchen-eta";

const ETA_POLL_INTERVAL_MS = 15000; // same cadence as KitchenBoard / OrderTrackingTimeline

type KitchenEtaResponse = {
  kitchenPrepMinutes: number;
  etaByMethod: {
    UBER_EATS: { min: number; max: number };
    FOOD_PANDA: { min: number; max: number };
  };
};

interface BillingFormData {
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  apartment: string;
  city: string;
  state: string;
  zip: string;
  phoneNumber: string;
}

type BillingErrors = Partial<Record<keyof BillingFormData | "selectedCountry", string>>;
type PaymentErrors = Partial<Record<"isAgreedToTerms", string>>;

const SHIPPING_METHOD_MAP: Record<string, "UBER_EATS" | "FOOD_PANDA"> = {
  "uber-eats": "UBER_EATS",
  "food-panda": "FOOD_PANDA",
};

// Digits only, optional leading "+" for a country code, 7-15 digits — E.164
// max length. Matches the same rule enforced server-side in
// src/lib/order-checkout-shared.ts (validateBilling) so a direct API call
// can't bypass this by skipping the UI.
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

const Carts = () => {
  const router = useRouter();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { cartItems, increaseQty, decreaseQty, removeFromCart, clearCart } = useCart();

  // QR Table Ordering — when a customer arrived via a table's QR code
  // (/dine-in?table=<id>), isDineIn is true and tableId/tableLabel are set.
  // This drives all the conditional UI below: no delivery address, no
  // shipping method, payment is always "Pay at Table".
  const { tableId, tableLabel, isDineIn, clearTable } = useTableOrder();

  const [selectedShipping, setSelectedShipping] = useState("uber-eats");
  const [kitchenEta, setKitchenEta] = useState<KitchenEtaResponse | null>(null);

  // Live Kitchen Queue / Smart ETA — replaces the old static
  // "Delivery time: 20m/35m" labels with a number that reflects how busy
  // the kitchen actually is right now (see src/lib/kitchen-eta.ts). Not
  // relevant for dine-in (no shipping method section shown at all), but
  // harmless to keep fetching — it's a cheap, unauthenticated poll.
  useEffect(() => {
    let isMounted = true;

    async function fetchEta() {
      try {
        const res = await fetch("/api/kitchen/eta");
        if (!res.ok) return;
        const data: KitchenEtaResponse = await res.json();
        if (isMounted) setKitchenEta(data);
      } catch {
        // network error — silently retry on next poll, keep showing last-known ETA
      }
    }

    fetchEta();
    const interval = setInterval(fetchEta, ETA_POLL_INTERVAL_MS);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [formData, setFormData] = useState<BillingFormData>({
    email: "",
    firstName: "",
    lastName: "",
    address: "",
    apartment: "",
    city: "",
    state: "",
    zip: "",
    phoneNumber: "",
  });

  const [isAgreedToTerms, setIsAgreedToTerms] = useState(false);
  // Opt-in checkbox for marketing offer emails — only shown/used for
  // delivery orders (dine-in never collects an email, so there's nothing
  // to sync to the Resend Audience for those). Defaults to false, never
  // pre-checked. See src/lib/resend.ts / src/app/api/orders/route.ts /
  // src/app/api/checkout/create-session/route.ts for the server side.
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    type: "PERCENT" | "FIXED";
    percentOff: number | null;
    fixedOff: number | null;
    // Snapshot of the eligible-lines subtotal at the moment "Apply" was
    // clicked — for an item/category-restricted coupon this may be less
    // than the full cart subtotal. Frozen at apply-time rather than
    // recomputed live (the cart here doesn't carry each item's
    // categoryId, so the client can't re-derive eligibility on its own);
    // the server re-validates and recomputes authoritatively at order
    // creation regardless, same as the pre-existing display-only caveat
    // below.
    eligibleSubtotal: number;
  } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Gift card — separate from the coupon above (both can be applied to
  // the same order, coupon discount first then gift card against what's
  // left, see the total calculation below). amountToApply is a snapshot
  // of what the server said it would deduct at the moment "Apply" was
  // clicked — recomputed against the live subtotal/discount below rather
  // than trusted verbatim as the cart changes, same reasoning as the
  // coupon's eligibleSubtotal snapshot above. The server re-validates and
  // re-debits authoritatively at order creation regardless.
  const [appliedGiftCard, setAppliedGiftCard] = useState<{
    code: string;
    balance: number;
  } | null>(null);
  const [isApplyingGiftCard, setIsApplyingGiftCard] = useState(false);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);

  const [errors, setErrors] = useState<BillingErrors>({});
  const [paymentErrors, setPaymentErrors] = useState<PaymentErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  // Recomputed from the applied coupon's rule on every render — not frozen
  // as a dollar amount at the moment "Apply" was clicked — so it stays
  // correct if the customer changes quantities afterward (for an
  // unrestricted coupon; a restricted coupon's eligibleSubtotal snapshot
  // is what's frozen instead, see the note above). This mirrors (but
  // doesn't need to exactly reproduce) the server's own cap/floor logic in
  // calcDiscountAmount, since the server independently recomputes the
  // authoritative amount from its own resolved subtotal at order-creation
  // time — this is purely for display.
  const discountAmount = appliedCoupon
    ? Math.min(
        appliedCoupon.type === "FIXED"
          ? appliedCoupon.fixedOff ?? 0
          : Math.round(appliedCoupon.eligibleSubtotal * ((appliedCoupon.percentOff ?? 0) / 100) * 100) / 100,
        appliedCoupon.eligibleSubtotal
      )
    : 0;
  const total = subtotal - discountAmount;

  // Same "min(what's owed, what's left on the card)" logic as
  // calcGiftCardAmountToApply on the server — purely for display, the
  // server independently recomputes the authoritative amount from its
  // own resolved total at order-creation time.
  const giftCardAmountApplied = appliedGiftCard
    ? Math.min(Math.max(total, 0), appliedGiftCard.balance)
    : 0;
  const finalTotal = total - giftCardAmountApplied;

  const handleConfirmOrder = async () => {
    if (cartItems.length === 0) {
      toast.warning("Please add an item before placing the order!", {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    const newErrors: BillingErrors = {};
    const newPaymentErrors: PaymentErrors = {};

    // firstName/lastName/phone are required for both order types — staff
    // still need a name to call out at the table for dine-in orders.
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required.";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required.";
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required.";
    } else if (!PHONE_REGEX.test(formData.phoneNumber.trim())) {
      newErrors.phoneNumber = "Enter a valid phone number (digits only, 7-15 digits).";
    }

    // Everything below is delivery-only — a dine-in order has no
    // destination to ship to and always pays at the table, so none of this
    // applies.
    if (!isDineIn) {
      if (!formData.email.trim()) newErrors.email = "Email is required.";
      if (!formData.address.trim()) newErrors.address = "Address is required.";
      if (!formData.city.trim()) newErrors.city = "City is required.";
      if (!formData.state.trim()) newErrors.state = "State is required.";
      if (!formData.zip.trim()) newErrors.zip = "Zip code is required.";
      if (!selectedCountry) newErrors.selectedCountry = "Country is required.";

      if (paymentMethod === "online") {
        if (!isAgreedToTerms) newPaymentErrors.isAgreedToTerms = "You must agree to the condition.";
      }
    }

    setErrors(newErrors);
    setPaymentErrors(newPaymentErrors);

    if (Object.keys(newErrors).length > 0 || Object.keys(newPaymentErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    const orderItems = cartItems.map((item) => ({
      id: item.id,
      title: item.title,
      quantity: item.quantity,
    }));

    try {
      // -----------------------------------------------------------------
      // Dine-in (QR Table Ordering) — always "Pay at Table", created
      // immediately via the same COD-style endpoint used for delivery COD
      // orders, just with orderType/tableId instead of address/shipping.
      // No email is ever collected for dine-in, so marketingConsent is
      // intentionally omitted here — there's nothing to sync to Resend.
      // -----------------------------------------------------------------
      if (isDineIn) {
        const billing = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phoneNumber,
        };

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: orderItems,
            billing,
            orderType: "DINE_IN",
            tableId,
            couponCode: appliedCoupon?.code,
            giftCardCode: appliedGiftCard?.code,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          toast.error(data?.error ?? "Failed to place order. Please try again.", {
            position: "top-center",
            autoClose: 3000,
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          return;
        }

        toast.success("Your order has been sent to the kitchen!", {
          position: "top-center",
          autoClose: 2000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });

        setFormData({
          email: "",
          firstName: "",
          lastName: "",
          address: "",
          apartment: "",
          city: "",
          state: "",
          zip: "",
          phoneNumber: "",
        });
        setErrors({});
        setAppliedCoupon(null);
        setDiscountCode("");
        setAppliedGiftCard(null);

        clearCart();
        // One scan → one order (v1 scope) — clear the table context so a
        // second order in the same tab requires a fresh QR scan, rather
        // than silently reusing this table forever.
        clearTable();
        router.push(`/track/${data.id}`);
        return;
      }

      const billing = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phoneNumber,
        country: selectedCountry?.label ?? "",
        address: formData.address,
        apartment: formData.apartment || undefined,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        // Only meaningful for delivery orders (they're the only ones with
        // an email on file) — see src/lib/order-checkout-shared.ts Billing
        // type and the server-side sync logic in /api/orders and
        // /api/checkout/create-session.
        marketingConsent,
      };
      const shippingMethod = SHIPPING_METHOD_MAP[selectedShipping];

      if (paymentMethod === "online") {
        // Redirect to Stripe's hosted Checkout page. The order is created
        // as PENDING payment on the server before we redirect — it's only
        // ever confirmed PAID (and only then does the confirmation email
        // go out) once Stripe's webhook verifies the actual charge. This
        // redirect happening is not, by itself, proof of payment.
        const res = await fetch("/api/checkout/create-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: orderItems,
            billing,
            shippingMethod,
            couponCode: appliedCoupon?.code,
            giftCardCode: appliedGiftCard?.code,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          toast.error(data?.error ?? "Failed to start checkout. Please try again.", {
            position: "top-center",
            autoClose: 3000,
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          setIsSubmitting(false);
          return;
        }

        clearCart();
        window.location.href = data.url; // full navigation — Stripe's page is a different origin
        return;
      }

      // Cash on Delivery — created immediately, no payment step.
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: orderItems,
          billing,
          shippingMethod,
          couponCode: appliedCoupon?.code,
          giftCardCode: appliedGiftCard?.code,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error ?? "Failed to place order. Please try again.", {
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        return;
      }

      toast.success("The Food order placed successfully!", {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        address: "",
        apartment: "",
        city: "",
        state: "",
        zip: "",
        phoneNumber: "",
      });
      setSelectedCountry(null);
      setErrors({});
      setIsAgreedToTerms(false);
      setMarketingConsent(false);
      setPaymentErrors({});
      setAppliedCoupon(null);
      setDiscountCode("");
      setAppliedGiftCard(null);

      clearCart();
      router.push(`/track/${data.id}`);
    } catch (err) {
      console.error("Order submission failed:", err);
      toast.error("Something went wrong placing your order. Please try again.", {
        position: "top-center",
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Strips anything that isn't a digit (or a leading "+" for a country
  // code) as the user types, instead of only catching it at submit time —
  // so letters/symbols simply never appear in the field rather than being
  // typed and then rejected.
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const hasLeadingPlus = raw.trimStart().startsWith("+");
    const digitsOnly = raw.replace(/\D/g, "");
    const cleaned = (hasLeadingPlus ? "+" : "") + digitsOnly;
    setFormData((prev) => ({ ...prev, phoneNumber: cleaned }));
  };

  const handleDiscountCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDiscountCode(e.target.value);
    setCouponError(null);
  };

  const applyDiscount = async () => {
    if (!discountCode.trim()) {
      setCouponError("Enter a coupon or gift card code");
      return;
    }
    if (cartItems.length === 0) {
      setCouponError("Add an item to your cart first");
      return;
    }

    setIsApplyingCoupon(true);
    setCouponError(null);

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: discountCode,
          items: cartItems.map((item) => ({
            id: item.id,
            title: item.title,
            quantity: item.quantity,
          })),
          phone: formData.phoneNumber || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        // The shared "Gift card or discount code" field could be either
        // kind — a coupon miss isn't necessarily wrong, it just might be
        // a gift card code instead, so fall back and try that lookup
        // before showing an error.
        await applyGiftCard();
        return;
      }

      setAppliedCoupon({
        code: data.code,
        type: data.type,
        percentOff: data.percentOff,
        fixedOff: data.fixedOff,
        eligibleSubtotal: data.eligibleSubtotal,
      });
      const discountLabel =
        data.type === "FIXED" ? `$${Number(data.fixedOff).toFixed(2)} off` : `${data.percentOff}% off`;
      toast.success(`"${data.code}" applied — ${discountLabel}!`, {
        position: "bottom-center",
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch {
      setCouponError("Something went wrong. Please try again.");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const applyGiftCard = async () => {
    setIsApplyingGiftCard(true);
    setGiftCardError(null);

    try {
      const res = await fetch("/api/gift-cards/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: discountCode, orderTotal: total }),
      });
      const data = await res.json();

      if (!res.ok) {
        setCouponError(data?.error ?? "Invalid coupon or gift card code");
        return;
      }

      setAppliedGiftCard({ code: data.code, balance: data.balance });
      toast.success(`Gift card "${data.code}" applied — $${Number(data.amountToApply).toFixed(2)} off!`, {
        position: "bottom-center",
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch {
      setCouponError("Something went wrong. Please try again.");
    } finally {
      setIsApplyingGiftCard(false);
    }
  };

  const removeGiftCard = () => {
    setAppliedGiftCard(null);
    setGiftCardError(null);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setDiscountCode("");
    setCouponError(null);
  };

  // NOTE: this section is rendered TWICE below (once for desktop layout,
  // once for mobile, toggled via Tailwind hidden/block classes). CSS
  // `hidden` only sets display:none — the hidden copy's <input> elements
  // stay in the DOM. If both copies shared the same `name`, the browser's
  // native radio-group behavior (grouped by `name`, not by visibility)
  // could silently check/uncheck the hidden duplicate instead of the
  // visible one — that's the "sometimes it doesn't visually select" bug.
  // Passing a unique idSuffix keeps the two copies in separate native
  // radio groups while both stay in sync via the shared state.
  //
  // Not rendered at all for dine-in orders — see shippingMethodSectionDesktop
  // / shippingMethodSectionMobile below, which are set to null when isDineIn.
  const renderShippingMethodSection = (idSuffix: string) => (
    <div className="space-y-4">
      <h4 className="3xl:text-2xl 2xl:text-2xl xl:text-2xl lg:text-2xl md:text-2xl sm:text-lg font-semibold text-gray-800 mb-2 pt-8">
        Available Shipping Method
      </h4>

      <div className="space-y-4">
        {/* Uber Eats */}
        <label
          className={`flex items-center justify-between border 3xl:px-4 3xl:py-3 2xl:px-4 2xl:py-3 xl:px-4 xl:py-3 lg:px-4 lg:py-3 md:px-4 md:py-3 sm:px-2 sm:py-1 cursor-pointer ${
            selectedShipping === "uber-eats" ? "border-gray-500 bg-gray-50" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-4">
            <img
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1751346396/63cecf750aa7463091b17adf_5310366-uber-eats-logo-png-and-vector-logo-download-uber-eats-png-3500_3500_preview_thtrrl.png"
              alt="Uber Eats"
              className="3xl:w-12 3xl:h-12 2xl:w-12 2xl:h-12 xl:w-12 xl:h-12 md:w-12 md:h-12 sm:w-8 sm:h-8"
            />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-800 sm:text-[11px] 3xl:text-[16px] 2xl:text-[16px] xl:text-[16px] lg:text-[16px] md:text-[15px]">
                  Uber eats
                </p>
                <span className="bg-green-100 text-green-700 text-[8px] px-2 py-0.5 rounded-full">
                  Suggested
                </span>
              </div>
              <p className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs text-gray-500">
                {kitchenEta
                  ? `Delivery time: ${formatMinutes(kitchenEta.etaByMethod.UBER_EATS.min)}/${formatMinutes(
                      kitchenEta.etaByMethod.UBER_EATS.max
                    )}`
                  : "Delivery time: calculating…"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:flex-col 3xl:flex-row 2xl:flex-row xl:flex-row lg:flex-row md:flex-row text-green-800 font-semibold 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs">
            Free
            <input
              type="radio"
              name={`shipping-${idSuffix}`}
              value="uber-eats"
              checked={selectedShipping === "uber-eats"}
              onChange={() => setSelectedShipping("uber-eats")}
              className="accent-green-700"
            />
          </div>
        </label>

        {/* Food Panda */}
        <label
          className={`flex items-center justify-between border px-4 py-3 cursor-pointer ${
            selectedShipping === "food-panda" ? "border-gray-500 bg-gray-50" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-4">
            <img
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1751346468/Group_973_w3ofel.png"
              alt="Food Panda"
              className="3xl:w-12 3xl:h-12 2xl:w-12 2xl:h-12 xl:w-12 xl:h-12 md:w-12 md:h-12 sm:w-8 sm:h-8"
            />
            <div>
              <p className="font-semibold text-gray-800 sm:text-[11px] 3xl:text-[16px] 2xl:text-[16px] xl:text-[16px] lg:text-[16px] md:text-[15px]">
                Food panda
              </p>
              <p className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs text-gray-500">
                {kitchenEta
                  ? `Delivery time: ${formatMinutes(kitchenEta.etaByMethod.FOOD_PANDA.min)}/${formatMinutes(
                      kitchenEta.etaByMethod.FOOD_PANDA.max
                    )}`
                  : "Delivery time: calculating…"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:flex-col 3xl:flex-row 2xl:flex-row xl:flex-row lg:flex-row md:flex-row text-green-800 font-semibold 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs">
            Free
            <input
              type="radio"
              name={`shipping-${idSuffix}`}
              value="food-panda"
              checked={selectedShipping === "food-panda"}
              onChange={() => setSelectedShipping("food-panda")}
              className="accent-green-700"
            />
          </div>
        </label>
      </div>
    </div>
  );

  // Same duplicate-DOM issue as shipping — see note above renderShippingMethodSection.
  // Dine-in shows a static "Pay at Table" panel instead of the online/cod
  // radio choice — payment always happens in person, there's no online
  // option for a dine-in order.
  const renderPaymentMethodSection = (idSuffix: string) => (
    <>
      <div className="space-y-4">
        <h4 className="3xl:text-2xl 2xl:text-2xl xl:text-2xl lg:text-2xl md:text-2xl sm:text-lg font-semibold text-gray-800 mb-2 pt-8">
          Payment Method
        </h4>

        {isDineIn ? (
          <div className="space-y-3 bg-gray-50 p-4 rounded-md">
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 mt-1 inline-block rounded-full border-2 border-gray-400 flex-shrink-0 bg-[#2C6252]"></span>
              <div>
                <p className="font-semibold text-gray-800">Pay at Table</p>
                <p className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs text-gray-600">
                  A staff member will collect payment at your table when your order is ready.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 bg-gray-50 p-4 rounded-md">
            {/* Online Payment */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name={`payment-${idSuffix}`}
                value="online"
                checked={paymentMethod === "online"}
                onChange={() => setPaymentMethod("online")}
                className="hidden"
              />
              <span
                className={`w-5 h-5 mt-1 inline-block rounded-full border-2 border-gray-400 flex-shrink-0 ${
                  paymentMethod === "online" ? "bg-[#2C6252]" : "bg-white"
                }`}
              ></span>
              <div>
                <p className="font-semibold text-gray-800">Online Payment</p>
                <p className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs text-gray-600">
                  Pay securely using a card or mobile wallet.
                </p>
              </div>
            </label>

            {/* Cash on Delivery */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name={`payment-${idSuffix}`}
                value="cod"
                checked={paymentMethod === "cod"}
                onChange={() => setPaymentMethod("cod")}
                className="hidden"
              />
              <span
                className={`w-5 h-5 mt-1 inline-block rounded-full border-2 border-gray-400 flex-shrink-0 ${
                  paymentMethod === "cod" ? "bg-[#2C6252]" : "bg-white"
                }`}
              ></span>
              <div>
                <p className="font-semibold text-gray-800">Cash on Delivery</p>
                <p className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs text-gray-600">
                  Pay with cash upon delivery.
                </p>
              </div>
            </label>
          </div>
        )}
      </div>

      {!isDineIn && paymentMethod === "online" && (
        <div className="mt-8 p-6 border border-gray-200 space-y-4">
          <div className="flex items-center 3xl:gap-8 2xl:gap-8 xl:gap-8 lg:gap-8 md:gap-8 sm:gap-4 flex-wrap">
            <img
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1751348676/pngegg_84_rh7u9t.png"
              alt="Mastercard"
              className="3xl:h-10 2xl:h-10 xl:h-10 lg:h-10 md:h-10 sm:h-6"
            />
            <img
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1751348700/pngegg_85_i6czbr.png"
              alt="Visa"
              className="3xl:h-10 2xl:h-10 xl:h-10 lg:h-10 md:h-10 sm:h-6"
            />
            <img
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1751348721/pngegg_86_icrxs1.png"
              alt="American Express"
              className="3xl:h-10 2xl:h-10 xl:h-10 lg:h-10 md:h-10 sm:h-6"
            />
          </div>

          <p className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs text-gray-600 flex items-start gap-2">
            <span className="text-[#2C6252] text-lg">&#128274;</span>
            You&apos;ll enter your card details securely on Stripe&apos;s payment page after
            clicking &quot;Confirm your order&quot; below — we never see or store your card
            number.
          </p>

          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={isAgreedToTerms}
              onChange={(e) => setIsAgreedToTerms(e.target.checked)}
              className="form-checkbox h-4 w-4 text-green-600 rounded"
            />
            <span className="text-gray-700 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[11px]">
              If you agree this condition please mark
            </span>
          </label>
          {paymentErrors.isAgreedToTerms && (
            <p className="text-red-500 text-xs mt-1">{paymentErrors.isAgreedToTerms}</p>
          )}
        </div>
      )}

      <button
        onClick={handleConfirmOrder}
        disabled={isSubmitting}
        className={`bg-[#2C6252] text-white w-full py-3 font-semibold 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs mt-4 ${
          isSubmitting ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        {isSubmitting
          ? "Placing order..."
          : isDineIn
          ? "Send order to the kitchen"
          : "Confirm your order"}
      </button>
    </>
  );

  // Shipping method doesn't exist for dine-in — nothing is being shipped.
  const shippingMethodSectionDesktop = isDineIn ? null : renderShippingMethodSection("desktop");
  const shippingMethodSectionMobile = isDineIn ? null : renderShippingMethodSection("mobile");
  const paymentMethodSectionDesktop = renderPaymentMethodSection("desktop");
  const paymentMethodSectionMobile = renderPaymentMethodSection("mobile");

  return (
    <Container>
      <div className="bg-white min-h-screen px-4 py-8 md:px-6 3xl:px-[4.2rem] xl:px-14 lg:px-0 2xl:px-4 3xl:mb-36 2xl:mb-28 xl:mb-28 lg:mb-24 sm:mb-10 lg:-ml-2 3xl:-ml-0 2xl:-ml-0 xl:-ml-0 md:-ml-20 sm:-ml-36 -mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="3xl:text-3xl 2xl:text-3xl xl:text-3xl lg:text-3xl md:text-2xl sm:text-lg font-semibold text-gray-800">
                  {isDineIn ? "Your Details" : "Billing Details"}
                </h3>
                {isDineIn && tableLabel && (
                  <span className="bg-[#2C6252] text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Table {tableLabel}
                  </span>
                )}
              </div>
              {isDineIn && (
                <p className="text-sm text-gray-500 -mt-2">
                  Just your name and phone number — your order goes straight to the kitchen for this table.
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <input
                  name="firstName"
                  type="text"
                  placeholder="First name"
                  className="border border-gray-300 px-4 py-2 rounded 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                  value={formData.firstName}
                  onChange={handleChange}
                />
                <input
                  name="lastName"
                  type="text"
                  placeholder="Last name"
                  className="border border-gray-300 px-4 py-2 rounded 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>
              {errors.firstName && <p className="text-red-500 text-xs">{errors.firstName}</p>}
              {errors.lastName && <p className="text-red-500 text-xs">{errors.lastName}</p>}

              {!isDineIn && (
                <>
                  <Select<CountryOption>
                    inputId="country-select"
                    instanceId="country-select"
                    options={COUNTRY_OPTIONS}
                    value={selectedCountry}
                    onChange={(option: SingleValue<CountryOption>) => setSelectedCountry(option)}
                    placeholder="Select country"
                    styles={{
                      menuList: (base) => ({ ...base, maxHeight: 220 }),
                      control: (base) => ({
                        ...base,
                        borderColor: "#d1d5db",
                        minHeight: "38px",
                        fontSize: "0.875rem",
                      }),
                    }}
                  />
                  {errors.selectedCountry && (
                    <p className="text-red-500 text-xs">{errors.selectedCountry}</p>
                  )}

                  <input
                    name="address"
                    type="text"
                    placeholder="Address line 1 and 2 example"
                    className="w-full border border-gray-300 px-4 py-2 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                    value={formData.address}
                    onChange={handleChange}
                  />
                  {errors.address && <p className="text-red-500 text-xs">{errors.address}</p>}

                  <input
                    name="apartment"
                    type="text"
                    placeholder="Apartment suite etc (optional)"
                    className="w-full border border-gray-300 px-4 py-2 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                    value={formData.apartment}
                    onChange={handleChange}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <input
                      name="city"
                      type="text"
                      placeholder="City"
                      className="border border-gray-300 px-4 py-2 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[11px]"
                      value={formData.city}
                      onChange={handleChange}
                    />
                    <input
                      name="state"
                      type="text"
                      placeholder="State"
                      className="border border-gray-300 px-4 py-2 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[11px]"
                      value={formData.state}
                      onChange={handleChange}
                    />
                    <input
                      name="zip"
                      type="text"
                      placeholder="Zip"
                      className="border border-gray-300 px-4 py-2 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[11px]"
                      value={formData.zip}
                      onChange={handleChange}
                    />
                  </div>
                  {errors.city && <p className="text-red-500 text-xs">{errors.city}</p>}
                  {errors.state && <p className="text-red-500 text-xs">{errors.state}</p>}
                  {errors.zip && <p className="text-red-500 text-xs">{errors.zip}</p>}

                  <input
                    type="email"
                    name="email"
                    placeholder="Email address"
                    className="w-full border border-gray-300 px-4 py-2 rounded 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                    value={formData.email}
                    onChange={handleChange}
                  />
                  {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}

                  {/* Marketing opt-in — delivery orders only, since dine-in
                      never collects an email to sync to Resend. Unchecked
                      by default; never pre-selected. */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="form-checkbox h-4 w-4 text-green-600 rounded"
                    />
                    <span className="text-gray-700 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[11px]">
                      Email me about special offers and discounts
                    </span>
                  </label>
                </>
              )}

              <input
                name="phoneNumber"
                type="tel"
                inputMode="numeric"
                maxLength={16}
                placeholder="Phone number"
                className="w-full border border-gray-300 px-4 py-2 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                value={formData.phoneNumber}
                onChange={handlePhoneChange}
              />
              {errors.phoneNumber && <p className="text-red-500 text-xs">{errors.phoneNumber}</p>}

              <div className="hidden lg:block">
                {shippingMethodSectionDesktop}
                {paymentMethodSectionDesktop}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="bg-gray-50 p-6 border border-gray-200 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Order summary</h3>
            <div className="space-y-4">
              {cartItems.length === 0 ? (
                <p className="text-sm text-gray-500">Your cart is empty.</p>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="flex items-start sm:gap-2 md:gap-4 3xl:gap-4 2xl:gap-4 xl:gap-4 lg:gap-4">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="3xl:w-16 3xl:h-16 2xl:w-16 2xl:h-16 xl:w-16 xl:h-16 lg:w-16 lg:h-16 md:w-16 md:h-16 sm:w-10 sm:h-10 object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[10px] text-gray-800">
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="3xl:text-xs 2xl:text-xs xl:text-xs lg:text-xs md:text-xs sm:text-[7px] text-gray-500">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center mt-2 space-x-2">
                        <button
                          onClick={() => decreaseQty(item.id)}
                          className="bg-gray-200 px-2 py-1 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                        >
                          −
                        </button>
                        <span className="text-sm">{item.quantity}</span>
                        <button
                          onClick={() => increaseQty(item.id)}
                          className="bg-gray-200 px-2 py-1 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="sm:flex sm:flex-col sm:items-end 3xl:flex-row 2xl:flex-row xl:flex-row lg:flex-row md:flex-row items-center">
                      <div className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs font-semibold text-gray-800 whitespace-nowrap">
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="ml-2 text-red-600 hover:text-red-800 font-bold 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                        aria-label={`Remove ${item.title} from cart`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-10 border-t border-gray-200">
              {appliedCoupon ? (
                <div className="flex items-center justify-between mb-10 bg-green-50 border border-green-200 px-4 py-2 rounded">
                  <span className="text-sm text-green-800 font-medium">
                    &quot;{appliedCoupon.code}&quot; applied —{" "}
                    {appliedCoupon.type === "FIXED"
                      ? `$${(appliedCoupon.fixedOff ?? 0).toFixed(2)} off`
                      : `${appliedCoupon.percentOff}% off`}
                  </span>
                  <button
                    onClick={removeCoupon}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex mb-2">
                    <input
                      type="text"
                      placeholder="Gift card or discount code"
                      className="flex-1 border border-gray-300 3xl:px-4 2xl:px-4 xl:px-2 lg:px-2 py-2 md:px-2 sm:px-2 3xl:text-sm 2xl:text-sm xl:text-[12px] lg:text-[11px] md:text-[11px] sm:text-[8px] focus:outline-none focus:ring-1 focus:ring-gray-400"
                      value={discountCode}
                      onChange={handleDiscountCodeChange}
                    />
                    <button
                      onClick={applyDiscount}
                      disabled={isApplyingCoupon}
                      className="bg-gray-400 text-white 3xl:px-6 2xl:px-6 xl:px-2 lg:px-2 md:px-2 sm:px-2 py-2 font-semibold 3xl:text-sm 2xl:text-sm xl:text-[12px] lg:text-[11px] md:text-[11px] sm:text-[8px] hover:bg-gray-500 transition-colors disabled:opacity-50"
                    >
                      {isApplyingCoupon ? "Checking…" : "Apply"}
                    </button>
                  </div>
                  {couponError && (
                    <p className="text-xs text-red-500 mb-8">{couponError}</p>
                  )}
                  {!couponError && <div className="mb-4" />}
                </>
              )}

              {appliedGiftCard ? (
                <div className="flex items-center justify-between mb-10 bg-green-50 border border-green-200 px-4 py-2 rounded">
                  <span className="text-sm text-green-800 font-medium">
                    Gift card &quot;{appliedGiftCard.code}&quot; applied — ${giftCardAmountApplied.toFixed(2)} off
                    {appliedGiftCard.balance > giftCardAmountApplied &&
                      ` (${(appliedGiftCard.balance - giftCardAmountApplied).toFixed(2)} left on card)`}
                  </span>
                  <button
                    onClick={removeGiftCard}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                isApplyingGiftCard && (
                  <p className="text-xs text-gray-400 mb-8">Checking gift card…</p>
                )
              )}
            </div>
            <div className="space-y-10 bg-white p-6">
              <div className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[11px] text-gray-700 space-y-5">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span className={discountAmount > 0 ? "text-[#2C6252]" : ""}>
                    {discountAmount > 0 ? `-$${discountAmount.toFixed(2)}` : "$0"}
                  </span>
                </div>
                {giftCardAmountApplied > 0 && (
                  <div className="flex justify-between">
                    <span>Gift card</span>
                    <span className="text-[#2C6252]">-${giftCardAmountApplied.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{isDineIn ? "Table service" : "Delivery charges"}</span>
                  <span className="text-[#2C6252]">Free</span>
                </div>
              </div>

              <div className="border-t border-dashed border-gray-300 my-4"></div>
              <div className="flex justify-between 3xl:text-md 2xl:text-md xl:text-md lg:text-md md:text-md sm:text-xs font-bold pt-2">
                <span>Total</span>
                <span className="text-[#2C6252]">USD ${finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="block lg:hidden">
            {shippingMethodSectionMobile}
            {paymentMethodSectionMobile}
          </div>
        </div>
      </div>
    </Container>
  );
};

export default Carts;