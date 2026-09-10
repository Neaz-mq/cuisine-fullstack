"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Container from "@/components/Container";
import { useCart } from "@/context/CartContext";
import { useTableOrder } from "@/context/TableOrderContext";
import Select, { SingleValue } from "react-select";
import { Trash2, Truck } from "lucide-react";
import { toast } from "react-toastify";
import { COUNTRY_OPTIONS, type CountryOption } from "@/data/countries";
import { formatMinutes } from "@/lib/kitchen-eta";

const ETA_POLL_INTERVAL_MS = 15000; // same cadence as KitchenBoard / OrderTrackingTimeline

type KitchenEtaResponse = {
  kitchenPrepMinutes: number;
  etaByMethod: {
    UBER_EATS: { min: number; max: number };
    FOOD_PANDA: { min: number; max: number };
    OWN_DELIVERY: { min: number; max: number };
  };
};

/**
 * The bill, as computed by /api/checkout/quote.
 *
 * ⚠️ Every money field is a STRING, not a number, and that is deliberate.
 * The server holds these as Prisma Decimal and serialises them with the
 * right number of decimal places for the restaurant's currency — 0 for
 * yen, 3 for Kuwaiti dinar. Parsing them back into JS numbers here would
 * throw that away and reintroduce exactly the float drift the money model
 * migration removed. These are display values: render them, never compute
 * with them.
 *
 * ⚠️ And do NOT import @/lib/pricing or @/lib/money here to "just do the
 * maths locally". Both reach the generated Prisma client, which pulls in
 * `node:module`, which cannot exist in a browser bundle — the production
 * build dies with "the chunking context does not support external
 * modules". This project has already hit that once.
 */
type Quote = {
  currency: string;
  currencyMinorUnits: number;
  taxName: string;
  taxMode: "INCLUSIVE" | "EXCLUSIVE";
  tipEnabled: boolean;
  subtotal: string;
  discountAmount: string;
  tierDiscountAmount: string;
  serviceCharge: string;
  deliveryFee: string;
  taxAmount: string;
  grandTotal: string;
  giftCardAmount: string;
  pointsRedeemedAmount: string;
  pointsRedeemed: number;
  tipAmount: string;
  totalAmount: string;
  appliedCouponCode: string | null;
  appliedGiftCardCode: string | null;

  /**
   * Delivery charge কীভাবে ঠিক হয়েছে।
   *
   * ⚠️ `deliveryFeeMode` ছাড়া এই component "Free" আর "এখনো হিসাব হয়নি"
   * — দুটোর পার্থক্য করতে পারে না। DISTANCE mode-এ ঠিকানা অসম্পূর্ণ
   * থাকলে ফি শূন্যই আসে (geocode হয়নি), অথচ সেটা বিনামূল্যে নয়।
   * দুটোকে এক দেখানো মানে গ্রাহককে ভুল দাম দেখিয়ে checkout-এ পাঠানো।
   *
   * `deliveryZoneLabel` ("3–5 Km") কেবল ব্যাখ্যার জন্য — ফি-টা কেন
   * এই অঙ্ক, সেটা এক নজরে বোঝাতে।
   */
  deliveryFeeMode: "FLAT" | "DISTANCE";
  deliveryDistanceKm: number | null;
  deliveryZoneLabel: string | null;
  // giftCardBalance ইচ্ছাকৃতভাবে নেই — server আর পাঠায় না। কার্ডে কত
  // পড়ে আছে সেটা এই পাতার দরকার হয় না (giftCardAmount বলে দেয় এই
  // বিলে কতটা কাটছে), আর কেউ কোড অনুমান করে ফেললে তাকে বাড়তি কিছু
  // জানানোর কারণ নেই।
};

type PublicSettings = {
  currency: string;
  tipEnabled: boolean;
  tipPresetPercents: number[];
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

const SHIPPING_METHOD_MAP: Record<string, "UBER_EATS" | "FOOD_PANDA" | "OWN_DELIVERY"> = {
  "uber-eats": "UBER_EATS",
  "food-panda": "FOOD_PANDA",
  "own-delivery": "OWN_DELIVERY",
};

// Digits only, optional leading "+" for a country code, 7-15 digits — E.164
// max length. Matches the same rule enforced server-side in
// src/lib/order-checkout-shared.ts (validateBilling) so a direct API call
// can't bypass this by skipping the UI.
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

/** A money string is "nothing" if it parses to zero — "0", "0.00", "0.000". */
const isPositive = (value: string | null | undefined) => !!value && parseFloat(value) > 0;

/**
 * ── বাঁ কলামের অভিন্ন চেহারা ─────────────────────────────────────────
 *
 * Figma "Web/Checkout": প্রতিটা অংশ একটা cream কার্ড (radius 20,
 * padding 30), ভেতরে Frank Ruhl শিরোনাম + Sora উপশিরোনাম, তারপর
 * সাদা ঘর।
 *
 * ⚠️ এগুলো এক জায়গায় রাখা হয়েছে কারণ তিনটে অংশ (Billing, Shipping,
 * Payment) হুবহু একই খোলস ভাগ করে। আগে প্রতিটায় হাতে লেখা ছিল
 * `3xl:text-2xl 2xl:text-2xl xl:text-2xl lg:text-2xl md:text-2xl
 * sm:text-lg` — ছয়টা breakpoint-এ একই মান, আর বদলাতে গেলে তিন
 * জায়গায় হাত দিতে হতো।
 *
 * ⚠️ `components/admin/modal-ui.tsx`-এর FIELD/LABEL ব্যবহার করা
 * হয়নি, যদিও চেহারা কাছাকাছি। ওগুলোর ঘর cream (`#F9F6F3`), কারণ
 * ওরা সাদা modal-এ বসে। এখানে উল্টো — কার্ডটাই cream, তাই ঘর সাদা
 * হতে হবে, নাহলে ঘরের কিনারা দেখাই যেত না।
 */
const CARD = "flex flex-col gap-5 rounded-[20px] bg-[#F9F6F3] p-4 md:p-6 xl:p-[30px]";

const CARD_TITLE =
  "font-frank-ruhl text-[20px] font-semibold leading-none text-black md:text-[24px] xl:text-[28px]";

const CARD_SUBTITLE = "mt-2 font-sora text-[12px] leading-[1.6] text-black/50";

/** ফর্মের ঘর — সাদা, radius 12, উচ্চতা 46। */
const FIELD_INPUT =
  "h-[46px] w-full rounded-[12px] bg-white px-3.5 font-sora text-[13px] leading-none text-black placeholder:text-black/35 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]";


const Carts = () => {
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { cartItems, increaseQty, decreaseQty, removeFromCart, clearCart, addToCart } = useCart();

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
  // AI Upsell — "Pairs well with" suggestions for the current cart.
  type PairSuggestion = {
    id: string;
    title: string;
    description: string;
    price: number;
    imageUrl: string | null;
  };
  const [pairSuggestions, setPairSuggestions] = useState<PairSuggestion[]>([]);
  const [isLoadingPairs, setIsLoadingPairs] = useState(false);

  // An empty cart has nothing to pair with, so that case is DERIVED here at
  // render time rather than pushed into state by an effect calling
  // setPairSuggestions([]).
  //
  // Doing it in the effect was what react-hooks/set-state-in-effect flagged:
  // setState inside an effect body forces React into a second render pass it
  // didn't need, and for one frame the stale suggestions from the previous
  // cart were still on screen after the cart had already been emptied.
  // Anything computable from props/state during render belongs in render.
  const visiblePairSuggestions = cartItems.length === 0 ? [] : pairSuggestions;

  // As the cart's contents change, ask the server which items most often
  // co-occur (in past orders) with what's already in the cart — see
  // src/lib/recommendations.ts:getPairsWellWith — and surface them right
  // in the order summary, at the moment a customer is about to check out.
  useEffect(() => {
    // Nothing to fetch for an empty cart. The stale `pairSuggestions` state
    // is simply not read in that case (see visiblePairSuggestions above), so
    // there's no need to clear it here.
    if (cartItems.length === 0) return;

    let isCancelled = false;
    const cartItemIds = cartItems.map((item) => item.id);

    // Debounce — qty +/- clicks fire fast, no need for a request per click.
    const timeout = setTimeout(async () => {
      setIsLoadingPairs(true);
      try {
        const res = await fetch("/api/recommendations/pairs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartItemIds }),
        });
        if (!res.ok) return;
        const data: { items: PairSuggestion[] } = await res.json();
        if (!isCancelled) {
          // Belt-and-suspenders: never show something already in the
          // cart, even if the cart changed again while in flight.
          setPairSuggestions(data.items.filter((s) => !cartItemIds.includes(s.id)));
        }
      } catch {
        // Upsell is a nice-to-have — fail silently, keep the cart usable.
      } finally {
        if (!isCancelled) setIsLoadingPairs(false);
      }
    }, 400);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
    // Only re-run when the *set* of item ids changes, not quantities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems.map((item) => item.id).join(",")]);

  const handleAddPairSuggestion = (suggestion: PairSuggestion) => {
    addToCart({
      id: suggestion.id,
      title: suggestion.title,
      price: suggestion.price,
      quantity: 1,
      imageUrl: suggestion.imageUrl ?? undefined,
      description: suggestion.description,
    });
    toast.success(`${suggestion.title} added to cart`);
  };

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
    // ⚠️ No eligibleSubtotal snapshot any more. What a coupon is worth
    // against this bill is decided server-side and arrives in the quote —
    // the client can't work it out, because it doesn't know the tax,
    // service charge or delivery fee sitting around it.
  } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Gift card — separate from the coupon above (both can be applied to
  // the same order). Only the CODE lives here; how much of it comes off
  // this bill is decided server-side and arrives in the quote, because it
  // depends on a grand total this component no longer computes.
  const [appliedGiftCard, setAppliedGiftCard] = useState<{ code: string } | null>(null);
  const [isApplyingGiftCard, setIsApplyingGiftCard] = useState(false);

  // Loyalty points redemption — fetched from the customer's OWN account
  // (never trusted from anywhere client-writable), see
  // /api/loyalty/me. null while loading or for a guest/logged-out
  // customer, in which case the whole redemption UI below stays hidden —
  // there's no account to hold a balance on. `redeemedPoints` is how
  // many the customer has asked to apply; how many are actually accepted,
  // and what they are worth, comes back in the quote.
  const [loyaltyInfo, setLoyaltyInfo] = useState<{
    points: number;
    tier: { id: string; label: string; discountPercent: number };
    redemption: { rate: number; minPoints: number; canRedeem: boolean };
  } | null>(null);
  const [redeemedPoints, setRedeemedPoints] = useState(0);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    fetch("/api/loyalty/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setLoyaltyInfo(data);
      })
      .catch(() => {
        // Silent — the redemption section just doesn't render if this
        // fails, same as any other optional checkout enhancement. The
        // order can still be placed without it.
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  // Tipping — a preset percentage OR a custom amount, never both. Picking
  // one clears the other, so there is never an ambiguous state where the
  // customer can't tell what they are actually tipping.
  const [tipPercent, setTipPercent] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);
  /**
   * Quote endpoint যখন 409 দেয় — কার্যত একটাই কারণ: ঠিকানাটা
   * delivery zone-এর বাইরে ("we only deliver within 8 km")।
   *
   * ⚠️ আগে `if (!res.ok) return;` দিয়ে চুপচাপ উপেক্ষা করা হতো, ফলে
   * পুরোনো bill পর্দায় থেকে যেত আর গ্রাহক দিব্যি order দিয়ে দিতেন —
   * শুধু /api/orders সেটা প্রত্যাখ্যান করত, তখন কারণটা আর cart-এ
   * দেখা যেত না। এখন কারণটা এখানেই দেখানো হয় আর Confirm বোতাম বন্ধ
   * থাকে।
   */
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setSettings(data))
      .catch(() => {
        // Nothing breaks — the tip buttons just don't render.
      });
  }, []);

  const [errors, setErrors] = useState<BillingErrors>({});
  const [paymentErrors, setPaymentErrors] = useState<PaymentErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Figma-র "Congratulations!" — অর্ডার হয়ে যাওয়ার পর।
   *
   * ⚠️ আগে সরাসরি `/track/<id>`-এ redirect হতো, কোনো পর্দা ছাড়াই।
   * দ্রুত, কিন্তু গ্রাহক এক ঝটকায় অন্য পাতায় গিয়ে পড়তেন আর "সত্যিই
   * হলো তো?" প্রশ্নটা রয়ে যেত — toast ততক্ষণে মিলিয়ে যায়।
   *
   * ⚠️ modal-টা redirect **আটকায় না, পিছিয়ে দেয়**: "Order Tracker"
   * চাপলে সেই একই পাতায় যায়। id-টা এখানে রাখা থাকে, তাই কেউ modal
   * ছেড়ে চলে গেলেও অর্ডারটা হারায় না।
   */
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  // Only used before the first quote lands, and to give
  // /api/gift-cards/validate a rough figure for its toast. No money
  // decision is ever made from it.
  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // An empty cart has nothing to price, so that case is DERIVED here at
  // render time rather than pushed into state by an effect calling
  // setQuote(null) — exactly the same reasoning (and the same lint rule,
  // react-hooks/set-state-in-effect) as visiblePairSuggestions above.
  // The stale quote simply isn't read once the cart is empty.
  const bill = cartItems.length === 0 ? null : quote;

  const currency = bill?.currency ?? settings?.currency ?? "";
  const money = (value: string) => `${currency} ${value}`;

  const cappedRedeemedPoints = bill?.pointsRedeemed ?? 0;
  const maxAffordablePoints = loyaltyInfo
    ? Math.floor(Math.max(subtotal, 0) / loyaltyInfo.redemption.rate)
    : 0;

  /**
   * Figma-র loyalty চিপগুলো — slider-এর বদলে গোনা কয়েকটা বিকল্প।
   *
   * ⚠️ সংখ্যাগুলো hardcode করা হয়নি (Figma-তে ১০ আর ২০)। ধাপ শুরু হয়
   * `redemption.minPoints` থেকে, তারপর তার গুণিতক — কারণ ওই সীমার
   * নিচে server কিছুই কাটে না, আর মাঝের কোনো সংখ্যা বাছতে দিলে সেটা
   * নীরবে নিচে গোল হয়ে যেত।
   *
   * ⚠️ চারটের বেশি নয়, আর গ্রাহকের কাছে যত পয়েন্ট আছে বা এই অর্ডারে
   * যতটা কাজে লাগে — যেটা কম, তার বেশি নয়। "৫০০ পয়েন্ট" চিপটা
   * দেখিয়ে চাপার পর "আপনার অত নেই" বলা অর্থহীন।
   */
  const pointOptions = useMemo(() => {
    if (!loyaltyInfo?.redemption.canRedeem) return [];

    const step = loyaltyInfo.redemption.minPoints;
    const ceiling = Math.min(loyaltyInfo.points, maxAffordablePoints);
    const out: { points: number; value: number }[] = [];

    for (let points = step; points <= ceiling && out.length < 4; points += step) {
      out.push({ points, value: points * loyaltyInfo.redemption.rate });
    }
    return out;
  }, [loyaltyInfo, maxAffordablePoints]);

  const tipPresets = settings?.tipEnabled ? settings.tipPresetPercents : [];
  const showTipping = tipPresets.length > 0 && cartItems.length > 0;

  /**
   * ঠিকানা → quote, কিন্তু **নিজস্ব, দীর্ঘতর** debounce-এ।
   *
   * নিচের quote effect-টার debounce ৩০০ms — quantity বা tip-এর জন্য
   * ঠিক আছে, কারণ ওগুলো ক্লিক, টাইপিং নয়। ঠিকানা টাইপ করা হয়, আর
   * প্রতিটা থেমে-যাওয়ায় server একটা করে **geocode** চালায়।
   *
   * Nominatim-এর public instance সেকেন্ডে ~১টা request নেয়, আর
   * lib/geocode.ts ব্যর্থ হলে ৯ ধাপ পর্যন্ত fallback করে (মাঝে ১.১s
   * করে ঘুম)। "Bogura" লিখতে গিয়ে B → Bo → Bog … প্রতিটাতে quote
   * গেলে একজন গ্রাহকই ওই সীমা ছাড়িয়ে যেতেন।
   *
   * তাই ঠিকানা আলাদা করে ৮০০ms ধরে থিতু হয়, তারপর quote effect তার
   * ৩০০ms — মোট ~১.১s। cart বা tip বদলালে সেই দেরিটা লাগে না।
   */
  const addressForQuote = isDineIn
    ? null
    : {
        country: selectedCountry?.label ?? "",
        address: formData.address,
        apartment: formData.apartment,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
      };

  const [debouncedAddress, setDebouncedAddress] = useState<typeof addressForQuote>(null);

  // ⚠️ object নয়, একটা string-কে dependency করা হয়েছে। object প্রতি
  // render-এ নতুন reference পায়, তাই সেটা dep করলে effect-টা প্রতিবার
  // চলত আর debounce-এর কোনো মানেই থাকত না।
  const addressKey = addressForQuote ? Object.values(addressForQuote).join("|") : "";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAddress(addressForQuote), 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressKey]);

  /**
   * ঠিকানাটা geocode করার মতো যথেষ্ট ভরা কিনা — lib/delivery-fee.ts-এর
   * isGeocodable()-এর হুবহু একই নিয়ম (শহর + দেশ)।
   *
   * ⚠️ দুই জায়গায় একই নিয়ম লেখা আছে, আর সেটা জেনেশুনে: server-এরটাই
   * সিদ্ধান্ত নেয়, এটা কেবল ঠিক করে পর্দায় "Free" লিখব নাকি "Enter
   * address"। নিয়ম দুটো আলাদা হয়ে গেলে সবচেয়ে খারাপ যা হবে — এক
   * মুহূর্তের জন্য ভুল placeholder। কোনো টাকার সিদ্ধান্ত এখান থেকে
   * হয় না।
   */
  const hasGeocodableAddress = Boolean(selectedCountry && formData.city.trim());

  /**
   * DISTANCE mode, অথচ ঠিকানা এখনো অসম্পূর্ণ — অর্থাৎ ফি-টা এখনো
   * **জানা যায়নি**, শূন্য নয়।
   */
  const deliveryFeePending =
    !isDineIn && bill?.deliveryFeeMode === "DISTANCE" && !hasGeocodableAddress;

  /**
   * তিনটে shipping কার্ডের ডানদিকে যা লেখা থাকবে।
   *
   * ⚠️ আগে তিন জায়গাতেই আক্ষরিক "Free" hardcode করা ছিল। DISTANCE
   * mode চালু হওয়ার পর সেটা সরাসরি মিথ্যা — গ্রাহক "Free" পড়ে
   * অর্ডার দিতেন আর $2 কাটা হতো।
   *
   * ⚠️ তিনটে কার্ডেই একই লেখা, আর সেটা ঠিক আছে: ফি-টা দূরত্বের উপর
   * নির্ভর করে, কে পৌঁছে দিচ্ছে তার উপর নয়। কখনো courier-ভেদে আলাদা
   * ফি দরকার হলে সেটা delivery zone নয়, একটা আলাদা ধারণা।
   */
  const shippingFeeLabel = deliveryFeePending
    ? "—"
    : bill && isPositive(bill.deliveryFee)
      ? money(bill.deliveryFee)
      : "Free";

  /**
   * The bill is computed by the server, not here.
   *
   * This component used to carry six "display-only mirrors" — one
   * reimplementation each of the coupon, tier, gift-card and points rules,
   * plus the running totals. That was fine for as long as both sides
   * applied the same rules.
   *
   * The money model ended that. Tax, service charge, delivery fee and
   * tipping all come from RestaurantSettings, which this component knows
   * nothing about — so the customer was shown 100 while Stripe charged
   * 105. That is the worst kind of mismatch, because it only surfaces
   * after the card has been charged.
   *
   * So the arithmetic moved to /api/checkout/quote, which runs the very
   * same resolveOrderItems → findValidCoupon → calculateOrderPricing chain
   * that /api/orders runs when the order is really created. The two cannot
   * drift apart, because they are the same code.
   */
  useEffect(() => {
    // Nothing to price for an empty cart, and deliberately no setQuote(null)
    // here — see the `bill` derivation above for why.
    if (cartItems.length === 0) return;

    let cancelled = false;

    // Debounced — quantity +/- and typing in the custom tip box both fire
    // fast, and there is no point pricing an intermediate state.
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cartItems.map((item) => ({
              id: item.id,
              title: item.title,
              quantity: item.quantity,
            })),
            orderType: isDineIn ? "DINE_IN" : "DELIVERY",
            // দূরত্ব-ভিত্তিক delivery charge quote করার জন্য। অসম্পূর্ণ
            // হলে server নিজেই flat ফিতে নেমে আসে (isGeocodable), তাই
            // আধা-ভরা ঠিকানা পাঠানো নিরাপদ।
            deliveryAddress: debouncedAddress ?? undefined,
            // Optional, but it decides per-customer coupon limits — without
            // it the quote could promise a discount the order then refuses.
            phone: formData.phoneNumber || undefined,
            couponCode: appliedCoupon?.code,
            giftCardCode: appliedGiftCard?.code,
            redeemPoints: redeemedPoints > 0 ? redeemedPoints : undefined,
            tipPercent: tipPercent ?? undefined,
            tipAmount:
              tipPercent === null && customTip ? Number(customTip) || undefined : undefined,
          }),
        });
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          // ⚠️ 409 = "এই ঠিকানায় আমরা পৌঁছাই না" — গ্রাহককে বলার মতো
          // কথা, চুপ করে থাকার মতো নয়। বাকি status গুলো (429, 500)
          // ক্ষণস্থায়ী, তাই সেখানে আগের bill-ই থাকতে দেওয়া হয় আর
          // পরের পরিবর্তনে আবার চেষ্টা হয়।
          if (res.status === 409) setQuoteError(data?.error ?? "We can't deliver to this address.");
          return;
        }

        setQuoteError(null);
        setQuote(data as Quote);
      } catch {
        // Keep showing the last known bill; the next change retries.
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    cartItems,
    isDineIn,
    debouncedAddress,
    formData.phoneNumber,
    appliedCoupon?.code,
    appliedGiftCard?.code,
    redeemedPoints,
    tipPercent,
    customTip,
  ]);

  // Sent with the order. Mirrors the quote request exactly, so the customer
  // is charged the tip they were shown.
  const tipPayload = {
    tipPercent: tipPercent ?? undefined,
    tipAmount: tipPercent === null && customTip ? Number(customTip) || undefined : undefined,
  };

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

    // ⚠️ বোতামটা এমনিতেই disabled, কিন্তু guard-টা এখানেও থাকে —
    // disabled শুধু UI, আর এই handler কীবোর্ড বা অন্য পথেও ডাকা
    // যেতে পারে।
    if (quoteError) {
      toast.error(quoteError, { position: "top-center", autoClose: 3000 });
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
            redeemPoints: cappedRedeemedPoints > 0 ? cappedRedeemedPoints : undefined,
            ...tipPayload,
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
        setRedeemedPoints(0);
        setTipPercent(null);
        setCustomTip("");

        clearCart();
        // One scan → one order (v1 scope) — clear the table context so a
        // second order in the same tab requires a fresh QR scan, rather
        // than silently reusing this table forever.
        clearTable();
        // ⚠️ redirect-এর বদলে modal — ওখানকার "Order Tracker" বোতামটাই
        // এই পাতায় নিয়ে যায়।
        setPlacedOrderId(data.id);
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
            redeemPoints: cappedRedeemedPoints > 0 ? cappedRedeemedPoints : undefined,
            ...tipPayload,
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
          redeemPoints: cappedRedeemedPoints > 0 ? cappedRedeemedPoints : undefined,
          ...tipPayload,
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
      setRedeemedPoints(0);
      setTipPercent(null);
      setCustomTip("");

      clearCart();
      setPlacedOrderId(data.id);
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

    // A coupon slot is already filled — this field can now only be adding
    // a gift card, so skip straight to that lookup instead of re-trying
    // (and failing) the coupon endpoint first.
    if (appliedCoupon) {
      await applyGiftCard();
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
        // before showing an error. Only fall back if a gift card slot is
        // still open — with one already applied, a coupon miss is just a
        // coupon miss.
        if (!appliedGiftCard) {
          await applyGiftCard();
          return;
        }
        setCouponError(data?.error ?? "Invalid coupon or gift card code");
        return;
      }

      setAppliedCoupon({
        code: data.code,
        type: data.type,
        percentOff: data.percentOff,
        // ⚠️ `Number()` — API এখন সংখ্যাই পাঠায়, কিন্তু এখানেও রূপান্তর
        // রাখা হলো। state-এ যা ঢোকে তার ধরন এই component-এরই দায়িত্ব,
        // আর ঠিক এই জায়গাতেই একবার string ঢুকে `.toFixed()`-এ পুরো
        // পাতা ভেঙেছিল। route.ts-এ পুরো ব্যাখ্যা।
        fixedOff:
          data.fixedOff === null || data.fixedOff === undefined
            ? null
            : Number(data.fixedOff),
      });
      setDiscountCode("");
      const discountLabel =
        data.type === "FIXED"
          ? `${currency} ${Number(data.fixedOff).toFixed(2)} off`
          : `${data.percentOff}% off`;
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
    setCouponError(null);

    try {
      const res = await fetch("/api/gift-cards/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // A rough figure, purely so the endpoint can preview a sensible
        // "X off" in the toast below. The authoritative deduction is
        // recomputed in the quote, and again at order creation.
        body: JSON.stringify({ code: discountCode, orderTotal: subtotal }),
      });
      const data = await res.json();

      if (!res.ok) {
        setCouponError(data?.error ?? "Invalid coupon or gift card code");
        return;
      }

      setAppliedGiftCard({ code: data.code });
      setDiscountCode("");
      toast.success(
        `Gift card "${data.code}" applied — ${currency} ${Number(data.amountToApply).toFixed(2)} off!`,
        {
          position: "bottom-center",
          autoClose: 2000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        }
      );
    } catch {
      setCouponError("Something went wrong. Please try again.");
    } finally {
      setIsApplyingGiftCard(false);
    }
  };

  const removeGiftCard = () => {
    setAppliedGiftCard(null);
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
    <div className={CARD}>
      <div>
        <h4 className={CARD_TITLE}>Available Shipping Method</h4>
        <p className={CARD_SUBTITLE}>
          Select your preferred shipping method for fast and reliable delivery.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Uber Eats */}
        <label
          className={`flex items-center justify-between border 3xl:px-4 3xl:py-3 2xl:px-4 2xl:py-3 xl:px-4 xl:py-3 lg:px-4 lg:py-3 md:px-4 md:py-3 sm:px-2 sm:py-1 cursor-pointer ${
            selectedShipping === "uber-eats" ? "border-gray-500 bg-gray-50" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-4">
            <Image
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1751346396/63cecf750aa7463091b17adf_5310366-uber-eats-logo-png-and-vector-logo-download-uber-eats-png-3500_3500_preview_thtrrl.png"
              alt="Uber Eats"
              width={48}
              height={48}
              className="3xl:w-12 3xl:h-12 2xl:w-12 2xl:h-12 xl:w-12 xl:h-12 md:w-12 md:h-12 sm:w-8 sm:h-8 object-contain"
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
            {shippingFeeLabel}
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
            <Image
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1751346468/Group_973_w3ofel.png"
              alt="Food Panda"
              width={48}
              height={48}
              className="3xl:w-12 3xl:h-12 2xl:w-12 2xl:h-12 xl:w-12 xl:h-12 md:w-12 md:h-12 sm:w-8 sm:h-8 object-contain"
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
            {shippingFeeLabel}
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

        {/* Restaurant's own delivery rider — live GPS tracked */}
        <label
          className={`flex items-center justify-between border px-4 py-3 cursor-pointer ${
            selectedShipping === "own-delivery" ? "border-gray-500 bg-gray-50" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#2C6252]/10 flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6 text-[#2C6252]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-800 sm:text-[11px] 3xl:text-[16px] 2xl:text-[16px] xl:text-[16px] lg:text-[16px] md:text-[15px]">
                  Our Own Delivery
                </p>
                <span className="bg-green-100 text-green-700 text-[8px] px-2 py-0.5 rounded-full">
                  Live tracking
                </span>
              </div>
              <p className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs text-gray-500">
                {kitchenEta
                  ? `Delivery time: ${formatMinutes(kitchenEta.etaByMethod.OWN_DELIVERY.min)}/${formatMinutes(
                      kitchenEta.etaByMethod.OWN_DELIVERY.max
                    )}`
                  : "Delivery time: calculating…"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:flex-col 3xl:flex-row 2xl:flex-row xl:flex-row lg:flex-row md:flex-row text-green-800 font-semibold 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs">
            {shippingFeeLabel}
            <input
              type="radio"
              name={`shipping-${idSuffix}`}
              value="own-delivery"
              checked={selectedShipping === "own-delivery"}
              onChange={() => setSelectedShipping("own-delivery")}
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
      <div className={CARD}>
        <div>
          <h4 className={CARD_TITLE}>Payment Method</h4>
          <p className={CARD_SUBTITLE}>
            Choose your preferred payment method to complete your order securely.
          </p>
        </div>

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
            <Image
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1751348676/pngegg_84_rh7u9t.png"
              alt="Mastercard"
              width={64}
              height={40}
              className="3xl:h-10 2xl:h-10 xl:h-10 lg:h-10 md:h-10 sm:h-6 w-auto object-contain"
            />
            <Image
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1751348700/pngegg_85_i6czbr.png"
              alt="Visa"
              width={64}
              height={40}
              className="3xl:h-10 2xl:h-10 xl:h-10 lg:h-10 md:h-10 sm:h-6 w-auto object-contain"
            />
            <Image
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1751348721/pngegg_86_icrxs1.png"
              alt="American Express"
              width={64}
              height={40}
              className="3xl:h-10 2xl:h-10 xl:h-10 lg:h-10 md:h-10 sm:h-6 w-auto object-contain"
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

      {/* ⚠️ zone-এর বাইরের ঠিকানায় বোতামটা বন্ধ — কারণটা পাশেই লেখা
          থাকে (totals-এর উপরের banner), তাই গ্রাহক জানেন কী বদলাতে
          হবে। বোতাম খোলা রাখলে চাপার পর /api/orders একই কথা বলত,
          শুধু অনেক পরে আর কম স্পষ্ট করে। */}
      {/* Figma: gradient pill, উচ্চতা ৫০, radius 100। */}
      <button
        onClick={handleConfirmOrder}
        disabled={isSubmitting || !!quoteError}
        className={`mt-4 flex h-[50px] w-full items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] font-sora text-[15px] font-semibold leading-none text-white transition-opacity hover:opacity-90 md:text-[16px] ${
          isSubmitting || quoteError ? "cursor-not-allowed opacity-50" : ""
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

  const successModal = placedOrderId ? (
    /**
     * ⚠️ backdrop-এ ক্লিকে বন্ধ হয় না — অর্ডার হয়ে গেছে, আর ভুল করে
     * বাইরে ট্যাপ করে পর্দাটা হারিয়ে ফেললে tracker-এর লিঙ্কটাও যেত।
     * বন্ধ করার পথ দুটোই স্পষ্ট বোতাম।
     */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-success-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex w-full max-w-[555px] flex-col items-center gap-6 rounded-[30px] bg-white p-6 text-center md:gap-8 md:p-[30px]">
        <span
          aria-hidden="true"
          className="flex h-[140px] w-[140px] items-center justify-center rounded-full bg-[#FEF0E3] md:h-[194px] md:w-[194px]"
        >
          <svg
            className="h-[70px] w-[70px] md:h-[96px] md:w-[96px]"
            viewBox="0 0 100 100"
            fill="none"
            stroke="#FA7F12"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M50 6 66 14l18 2 2 18 8 16-8 16-2 18-18 2-16 8-16-8-18-2-2-18L4 66l8-16-2-18 18-2z" />
            <path d="M33 51l12 12 22-24" />
          </svg>
        </span>

        <div className="flex flex-col items-center gap-4 md:gap-5">
          <h2
            id="order-success-title"
            className="font-frank-ruhl text-[30px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[46px]"
          >
            Congratulations!
          </h2>
          <p className="font-sora text-[14px] leading-[1.6] text-black/70 md:text-[16px]">
            Your order has been successfully placed. We&apos;re preparing your meal with fresh
            ingredients.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 min-[420px]:flex-row">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex h-[46px] flex-1 items-center justify-center rounded-full border border-black font-sora text-[16px] font-semibold text-black transition-colors hover:bg-black hover:text-white"
          >
            Go to Home
          </button>
          <button
            type="button"
            onClick={() => router.push(`/track/${placedOrderId}`)}
            className="flex h-[46px] flex-1 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] font-sora text-[16px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Order Tracker
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <Container>
      {successModal}
      <div className="bg-white min-h-screen px-4 py-8 md:px-6 3xl:px-[4.2rem] xl:px-14 lg:px-0 2xl:px-4 3xl:mb-36 2xl:mb-28 xl:mb-28 lg:mb-24 sm:mb-10 lg:-ml-2 3xl:-ml-0 2xl:-ml-0 xl:-ml-0 md:-ml-20 sm:-ml-36 -mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            <div className={CARD}>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className={CARD_TITLE}>
                    {isDineIn ? "Your Details" : "Billing Details"}
                  </h3>
                  {isDineIn && tableLabel && (
                    <span className="rounded-full bg-black px-3 py-1.5 font-sora text-[11px] font-medium leading-none text-white">
                      Table {tableLabel}
                    </span>
                  )}
                </div>
                <p className={CARD_SUBTITLE}>
                  {isDineIn
                    ? "Just your name and phone number — your order goes straight to the kitchen for this table."
                    : "Enter your billing information to complete your order securely."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  name="firstName"
                  type="text"
                  placeholder="First name"
                  className={FIELD_INPUT}
                  value={formData.firstName}
                  onChange={handleChange}
                />
                <input
                  name="lastName"
                  type="text"
                  placeholder="Last name"
                  className={FIELD_INPUT}
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
                    className={FIELD_INPUT}
                    value={formData.address}
                    onChange={handleChange}
                  />
                  {errors.address && <p className="text-red-500 text-xs">{errors.address}</p>}

                  <input
                    name="apartment"
                    type="text"
                    placeholder="Apartment suite etc (optional)"
                    className={FIELD_INPUT}
                    value={formData.apartment}
                    onChange={handleChange}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <input
                      name="city"
                      type="text"
                      placeholder="City"
                      className={FIELD_INPUT}
                      value={formData.city}
                      onChange={handleChange}
                    />
                    <input
                      name="state"
                      type="text"
                      placeholder="State"
                      className={FIELD_INPUT}
                      value={formData.state}
                      onChange={handleChange}
                    />
                    <input
                      name="zip"
                      type="text"
                      placeholder="Zip"
                      className={FIELD_INPUT}
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
                    className={FIELD_INPUT}
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
                className={FIELD_INPUT}
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

          {/**
            * ── ডান কলাম: Order summary ───────────────────────────────
            *
            * Figma "Web/Checkout"-এর ডান পাশটা: cream মোড়ক (radius 20,
            * padding 30), ভেতরে প্রতিটা পদ একটা সাদা কার্ড — ছবি,
            * নাম, বর্ণনা, দাম, ডানে মোছার আইকন আর নিচে − ০১ + stepper।
            *
            * ⚠️ পুরোনো markup-টা `3xl:text-sm 2xl:text-sm xl:text-sm
            * lg:text-sm md:text-sm sm:text-[10px]` ধাঁচে লেখা ছিল —
            * ছয়টা breakpoint-এ একই মান, শুধু সবচেয়ে ছোটটায় আলাদা।
            * ওটা কার্যত `text-sm sm:text-[10px]`, কিন্তু পড়া যেত না
            * আর বদলাতে গেলে ছয় জায়গায় হাত দিতে হতো। বাকি প্রজেক্ট
            * mobile-first (`text-[13px] md:text-sm`), তাই এখানেও সেটাই।
            *
            * ⚠️ যা **যোগ করা হয়নি**: Figma-তে দামের পাশে একটা কাটা
            * পুরোনো দাম (`$21.78 $20.10`) দেখানো আছে। আমাদের কোনো
            * "আগের দাম" নেই — ছাড় আসে coupon/gift card/points থেকে,
            * আর সেগুলো নিচে নিজের নিজের সারিতে দেখানো হয়। একটা কাটা
            * সংখ্যা বানিয়ে দেখালে সেটা মিথ্যা হতো।
            */}
          <div className="flex flex-col gap-4 rounded-[20px] bg-[#F9F6F3] p-4 md:p-5 xl:p-[30px]">
            <h3 className="font-frank-ruhl text-[18px] font-semibold leading-none text-black md:text-[20px]">
              Order summary
            </h3>

            <div className="flex flex-col gap-3">
              {cartItems.length === 0 ? (
                <p className="rounded-[14px] bg-white px-4 py-8 text-center font-sora text-[13px] text-black/50">
                  Your cart is empty.
                </p>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="flex gap-3 rounded-[14px] bg-white p-3">
                    {item.imageUrl && (
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        width={64}
                        height={64}
                        unoptimized
                        className="h-14 w-14 shrink-0 rounded-[10px] object-cover md:h-16 md:w-16"
                      />
                    )}

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 font-frank-ruhl text-[14px] font-semibold leading-[1.3] text-black md:text-[15px]">
                          {item.title}
                        </p>
                        {/* ⚠️ Figma-র ট্র্যাশ আইকন। `×` ছিল — ছোট
                            পর্দায় ওটা "গুণ" চিহ্নের মতো দেখাত, আর
                            tap target-ও ছোট ছিল। */}
                        <button
                          onClick={() => removeFromCart(item.id)}
                          aria-label={`Remove ${item.title} from cart`}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-black/40 transition-colors hover:bg-[#D72A37]/10 hover:text-[#D72A37]"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                        </button>
                      </div>

                      {item.description && (
                        <p className="line-clamp-2 font-sora text-[11px] leading-[1.5] text-black/50">
                          {item.description}
                        </p>
                      )}

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="font-frank-ruhl text-[15px] font-semibold leading-none text-black">
                          {currency} {(item.price * item.quantity).toFixed(2)}
                        </span>

                        {/* Figma-র stepper: − ০১ +, ডানেরটা কালো গোল। */}
                        <span className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => decreaseQty(item.id)}
                            aria-label={`Decrease ${item.title} quantity`}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F9F6F3] font-sora text-[14px] leading-none text-black transition-colors hover:bg-black/10"
                          >
                            −
                          </button>
                          <span className="min-w-[18px] text-center font-sora text-[13px] font-medium tabular-nums text-black">
                            {/* ⚠️ Figma-তে "01" — দুই অঙ্কে প্যাড করা,
                                যাতে ১ থেকে ১০-এ গেলে stepper-টা লাফিয়ে
                                চওড়া না হয়। `tabular-nums`-ও সেই কারণেই। */}
                            {String(item.quantity).padStart(2, "0")}
                          </span>
                          <button
                            onClick={() => increaseQty(item.id)}
                            aria-label={`Increase ${item.title} quantity`}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-black font-sora text-[14px] leading-none text-white transition-opacity hover:opacity-80"
                          >
                            +
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* AI Upsell — "Pairs well with" */}
            {cartItems.length > 0 && (isLoadingPairs || visiblePairSuggestions.length > 0) && (
              <div className="pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Pairs well with</h4>
                {isLoadingPairs && visiblePairSuggestions.length === 0 ? (
                  <p className="text-xs text-gray-400">Finding good pairings…</p>
                ) : (
                  <div className="space-y-3">
                    {visiblePairSuggestions.map((suggestion) => (
                      <div key={suggestion.id} className="flex items-center gap-3">
                        {suggestion.imageUrl && (
                          <Image
                            src={suggestion.imageUrl}
                            alt={suggestion.title}
                            width={40}
                            height={40}
                            unoptimized
                            className="w-10 h-10 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-xs font-medium text-gray-800 leading-snug line-clamp-2"
                            title={suggestion.title}
                          >
                            {suggestion.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {currency} {suggestion.price.toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAddPairSuggestion(suggestion)}
                          className="text-xs font-semibold text-green-700 border border-green-600 px-3 py-1 rounded hover:bg-green-50 transition-colors whitespace-nowrap"
                          type="button"
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="pt-10 border-t border-gray-200">
              {appliedCoupon && (
                <div className="flex items-center justify-between mb-4 bg-green-50 border border-green-200 px-4 py-2 rounded">
                  <span className="text-sm text-green-800 font-medium">
                    &quot;{appliedCoupon.code}&quot; applied —{" "}
                    {appliedCoupon.type === "FIXED"
                      ? `${currency} ${(appliedCoupon.fixedOff ?? 0).toFixed(2)} off`
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
              )}

              {appliedGiftCard && (
                <div className="flex items-center justify-between mb-4 bg-green-50 border border-green-200 px-4 py-2 rounded">
                  <span className="text-sm text-green-800 font-medium">
                    Gift card &quot;{appliedGiftCard.code}&quot; applied
                    {bill && isPositive(bill.giftCardAmount) &&
                      ` — ${money(bill.giftCardAmount)} off`}
                  </span>
                  <button
                    onClick={removeGiftCard}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Loyalty points redemption — only shown to a logged-in
                  customer with a fetched balance (see the /api/loyalty/me
                  effect above). Automatic tier discount needs no UI here
                  at all — it's applied without any action, see the
                  totals block below. */}
              {loyaltyInfo && loyaltyInfo.redemption.canRedeem && (
                <div className="mb-4 border border-gray-200 rounded px-4 py-3">
                  {/**
                    * Figma "Redeem Loyalty Points" — চিপ, slider নয়।
                    *
                    * ⚠️ আগে একটা `<input type="range">` ছিল। দুটো
                    * সমস্যা ছিল ওতে:
                    *
                    *   • কত পয়েন্টে কত ছাড়, সেটা টেনে না দেখা পর্যন্ত
                    *     জানা যেত না — অথচ সিদ্ধান্তটা ঠিক ওই তথ্যের
                    *     উপরেই নির্ভর করে
                    *   • ছোঁয়া-পর্দায় slider-এর নির্ভুলতা খারাপ, আর
                    *     `step` = minPoints হওয়ায় ভুল টানে ২০০ পয়েন্ট
                    *     লাফিয়ে যেত
                    *
                    * চিপে দুটোই মেটে: প্রতিটায় পয়েন্ট **আর** টাকার
                    * অঙ্ক লেখা, আর ট্যাপ নির্ভুল।
                    *
                    * ⚠️ ছাড়ের অঙ্কটা এখানে `points × rate` দিয়ে
                    * দেখানো হয় — কিন্তু সেটা কেবল **প্রাক্কলন**।
                    * সত্যিকারের অঙ্ক আসে /api/checkout/quote থেকে
                    * (নিচের সবুজ লেখাটা), কারণ server সেটাকে
                    * subtotal-এর সীমায় কেটেও দিতে পারে।
                    */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-frank-ruhl text-[15px] font-semibold leading-none text-black">
                      Redeem Loyalty Points
                    </span>
                    <span className="shrink-0 rounded-full bg-black px-3 py-1.5 font-sora text-[11px] font-medium leading-none text-white">
                      {loyaltyInfo.points} Points
                    </span>
                  </div>

                  <p className="mt-1.5 font-sora text-[11px] leading-[1.5] text-black/50">
                    Use your points to get an instant discount on this order.
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {pointOptions.map((option) => {
                      const selected = redeemedPoints === option.points;
                      return (
                        <button
                          key={option.points}
                          type="button"
                          onClick={() => setRedeemedPoints(option.points)}
                          aria-pressed={selected}
                          className={`flex flex-col items-start gap-1 rounded-[12px] p-3 text-left transition-colors ${
                            selected
                              ? "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white"
                              : "bg-white text-black hover:bg-black/[0.04]"
                          }`}
                        >
                          <span className="font-frank-ruhl text-[14px] font-semibold leading-none">
                            {option.points} Points
                          </span>
                          <span
                            className={`font-sora text-[10px] leading-[1.4] ${
                              selected ? "text-white/80" : "text-black/50"
                            }`}
                          >
                            Saves {currency} {option.value.toFixed(2)} on this order
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Figma-র "Don't use points this time"। */}
                  <button
                    type="button"
                    onClick={() => setRedeemedPoints(0)}
                    aria-pressed={redeemedPoints === 0}
                    className={`mt-2 flex w-full items-center justify-between rounded-[12px] p-3 text-left font-sora text-[12px] transition-colors ${
                      redeemedPoints === 0
                        ? "bg-black text-white"
                        : "bg-white text-black/60 hover:bg-black/[0.04]"
                    }`}
                  >
                    Don&apos;t use points this time
                    {bill && isPositive(bill.pointsRedeemedAmount) && (
                      <span className="shrink-0 font-semibold text-[#2C6252]">
                        -{money(bill.pointsRedeemedAmount)}
                      </span>
                    )}
                  </button>

                  {/* ⚠️ server যা সত্যিই কাটবে — উপরের চিপের অঙ্ক নয়। */}
                  {cappedRedeemedPoints > 0 && (
                    <p className="mt-2 font-sora text-[11px] leading-[1.5] text-[#2C6252]">
                      {cappedRedeemedPoints} pts applied
                      {bill && isPositive(bill.pointsRedeemedAmount)
                        ? ` — ${money(bill.pointsRedeemedAmount)} off`
                        : ""}
                    </p>
                  )}
                </div>
              )}

              {/* One code can only be applied once each — show the shared
                  input as long as either slot (coupon or gift card) is
                  still open, so a second code can be added after the
                  first without needing to remove it first. */}
              {(!appliedCoupon || !appliedGiftCard) && (
                <>
                  {/**
                    * Figma-র "Enter your voucher" সারি: সাদা pill,
                    * ভেতরে ডানদিকে gradient "Apply Now" বোতাম।
                    *
                    * ⚠️ placeholder-টা কী কী প্রয়োগ করা যাবে তার সাথে
                    * বদলায় ("Gift card code" / "Discount code" /
                    * দুটোই) — Figma-তে একটাই স্থির লেখা, কিন্তু এখানে
                    * দুটো আলাদা স্লট আছে আর দুটোই একসাথে ভরে যেতে
                    * পারে। কোনটা এখনো খালি সেটা না বললে গ্রাহক
                    * বারবার ভুল কোড দিতেন।
                    *
                    * ⚠️ বোতামটা ঘরের **ভেতরে** (`pr-1.5` + absolute
                    * নয়, flex)। বাইরে বসালে সরু পর্দায় ইনপুটটা
                    * ~৯০px-এ নেমে আসত, আর কোড টাইপ করাই কঠিন হতো।
                    */}
                  <div className="flex h-[50px] items-center rounded-full bg-white pl-4 pr-1.5 focus-within:[outline:2px_solid_#FF9540] focus-within:[outline-offset:-2px]">
                    <input
                      type="text"
                      placeholder={
                        appliedCoupon
                          ? "Gift card code"
                          : appliedGiftCard
                            ? "Discount code"
                            : "Enter your voucher"
                      }
                      className="min-w-0 flex-1 bg-transparent font-sora text-[13px] leading-none text-black placeholder:text-black/40 focus:outline-none"
                      value={discountCode}
                      onChange={handleDiscountCodeChange}
                    />
                    <button
                      onClick={applyDiscount}
                      disabled={isApplyingCoupon || isApplyingGiftCard}
                      className="h-[38px] shrink-0 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[13px] font-semibold leading-none text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {isApplyingCoupon || isApplyingGiftCard ? "Checking…" : "Apply Now"}
                    </button>
                  </div>

                  {/* ⚠️ আগে ভুল হলে `mb-8`, না হলে একটা খালি `mb-4` div
                      বসত — অর্থাৎ ফাঁকটা দুই অবস্থায় দুরকম, আর বার্তা
                      এলে নিচের সবকিছু লাফাত। এখন ফাঁকটা বাইরের
                      `gap`-এ, তাই বার্তা এলে-গেলে কিছু নড়ে না। */}
                  {couponError && (
                    <p className="mt-2 font-sora text-[12px] leading-[1.5] text-[#D72A37]">
                      {couponError}
                    </p>
                  )}
                </>
              )}

              {/* Tipping — only rendered when the restaurant has it switched
                  on (see /api/settings). Off by default, and stays off for
                  Japan, South Korea and China, where offering a tip reads as
                  rude rather than generous. */}
              {showTipping && (
                <div className="mb-4 border border-gray-200 rounded px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-800">Add a tip</span>
                    {bill && isPositive(bill.tipAmount) && (
                      <span className="text-xs font-semibold text-[#2C6252]">
                        {money(bill.tipAmount)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTipPercent(null);
                        setCustomTip("");
                      }}
                      className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                        tipPercent === null && !customTip
                          ? "bg-[#2C6252] text-white border-[#2C6252]"
                          : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      No tip
                    </button>

                    {tipPresets.map((percent) => (
                      <button
                        key={percent}
                        type="button"
                        onClick={() => {
                          setTipPercent(percent);
                          // A preset and a custom amount are mutually
                          // exclusive — otherwise the customer can't tell
                          // which one they are actually being charged.
                          setCustomTip("");
                        }}
                        className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                          tipPercent === percent
                            ? "bg-[#2C6252] text-white border-[#2C6252]"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {percent}%
                      </button>
                    ))}

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Other"
                      value={customTip}
                      onChange={(e) => {
                        setCustomTip(e.target.value);
                        setTipPercent(null);
                      }}
                      className="w-20 text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                  </div>

                  <p className="text-[11px] text-gray-400 mt-2">
                    Percentages are of the food subtotal, before tax. Goes to the staff, never taxed.
                  </p>
                </div>
              )}
            </div>
            {/**
              * ── হিসাবের সারিগুলো ─────────────────────────────────────
              *
              * Figma: সাদা কার্ড, radius 14, ভেতরে Subtotal / Standard
              * delivery / Vat, নিচে একটা রেখা, তারপর "Total Price(2)"।
              *
              * নিচের প্রতিটা সংখ্যা আসে /api/checkout/quote থেকে — সেই
              * একই কোড যা অর্ডার তৈরির সময় দাম কষে। ব্রাউজারে কিছুই
              * হিসাব হয় না, তাই গ্রাহক যা পড়েন কার্ডে ঠিক সেটাই কাটে।
              *
              * ⚠️ `space-y-10` ছিল — ৪০px ফাঁক, অথচ Figma-তে ১২px।
              * সারিগুলো এত দূরে থাকলে কোনটা কীসের যোগফল সেটা চোখে ধরা
              * পড়ে না; হিসাবের তালিকা ঘন হওয়াই স্বাভাবিক।
              */}
            <div className="flex flex-col gap-3 rounded-[14px] bg-white p-4">
              {/**
                * Figma-র "1p. Beef Pizza — $12.99" সারিগুলো: প্রতিটার
                * বাঁয়ে একটা কমলা টিক।
                *
                * ⚠️ উপরের কার্ডগুলোতেও একই পদ, একই দাম — তাহলে দুবার
                * কেন? কারণ দুটোর কাজ আলাদা: উপরেরটা **সম্পাদনার**
                * জায়গা (stepper, মোছা), আর এটা **রসিদ** — যা যাচ্ছে
                * তার চূড়ান্ত তালিকা, ঠিক Subtotal-এর উপরে। টিকগুলো
                * সেই "নিশ্চিত হয়েছে" ভাবটাই দেয়।
                *
                * ⚠️ `1p.` মানে "1 piece" — Figma-র লেখা। পরিমাণ ১-এর
                * বেশি হলে সেটাই বসে (`3p.`), নাহলে সংখ্যাটা কোথাও
                * দেখা যেত না আর দুটো তালিকা অমিল লাগত।
                */}
              {cartItems.length > 0 && (
                <div className="flex flex-col gap-2.5 border-b border-black/10 pb-3">
                  {cartItems.map((item) => (
                    <div
                      key={`recap-${item.id}`}
                      className="flex items-center justify-between gap-3 font-sora text-[13px]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF9540] text-white"
                        >
                          <svg
                            className="h-2.5 w-2.5"
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M2.5 6.5 5 9l4.5-5.5" />
                          </svg>
                        </span>
                        <span className="truncate text-black">
                          {item.quantity}p. {item.title}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium text-black">
                        {currency} {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3 font-sora text-[13px] text-black/70">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{bill ? money(bill.subtotal) : `${currency} ${subtotal.toFixed(2)}`}</span>
                </div>

                {bill && isPositive(bill.discountAmount) && (
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span className="text-[#2C6252]">-{money(bill.discountAmount)}</span>
                  </div>
                )}

                {bill && isPositive(bill.tierDiscountAmount) && (
                  <div className="flex justify-between">
                    <span>{loyaltyInfo?.tier.label} tier discount</span>
                    <span className="text-[#2C6252]">-{money(bill.tierDiscountAmount)}</span>
                  </div>
                )}

                {bill && isPositive(bill.serviceCharge) && (
                  <div className="flex justify-between">
                    <span>Service charge</span>
                    <span>{money(bill.serviceCharge)}</span>
                  </div>
                )}

                {/**
                  * ⚠️ তিনটে আলাদা অবস্থা, তিন রকম লেখা — আর এই
                  * পার্থক্যটাই এখানে আসল কাজ:
                  *
                  *   "Enter address"  ফি এখনো **জানা যায়নি**
                  *   "$2.00"          ধাপ থেকে বসা ফি
                  *   "Free"           সত্যিই বিনামূল্যে
                  *
                  * প্রথমটাকে "Free" দেখানো হতো আগে, আর সেটাই ছিল
                  * সবচেয়ে বাজে ভুল: গ্রাহক Free পড়ে order দিতেন,
                  * আর server (যে পুরো ঠিকানাটা পায়) $2 বসিয়ে দিত।
                  */}
                <div className="flex justify-between">
                  <span>
                    {isDineIn ? "Table service" : "Delivery charges"}
                    {bill?.deliveryZoneLabel && (
                      <span className="text-gray-400"> · {bill.deliveryZoneLabel}</span>
                    )}
                  </span>
                  {deliveryFeePending ? (
                    <span className="text-gray-400">Enter address</span>
                  ) : bill && isPositive(bill.deliveryFee) ? (
                    <span>{money(bill.deliveryFee)}</span>
                  ) : (
                    <span className="text-[#2C6252]">Free</span>
                  )}
                </div>

                {bill && isPositive(bill.taxAmount) && (
                  <div className="flex justify-between">
                    <span>
                      {bill.taxName}
                      {/* INCLUSIVE mode: the tax is already inside the prices
                          above, so the total does NOT go up. Saying so out
                          loud is the difference between an EU-style bill and
                          a customer thinking they have been charged twice. */}
                      {bill.taxMode === "INCLUSIVE" && (
                        <span className="text-gray-400"> (included)</span>
                      )}
                    </span>
                    <span>{money(bill.taxAmount)}</span>
                  </div>
                )}

                {bill && isPositive(bill.giftCardAmount) && (
                  <div className="flex justify-between">
                    <span>Gift card</span>
                    <span className="text-[#2C6252]">-{money(bill.giftCardAmount)}</span>
                  </div>
                )}

                {bill && isPositive(bill.pointsRedeemedAmount) && (
                  <div className="flex justify-between">
                    <span>Points redeemed ({bill.pointsRedeemed} pts)</span>
                    <span className="text-[#2C6252]">-{money(bill.pointsRedeemedAmount)}</span>
                  </div>
                )}

                {bill && isPositive(bill.tipAmount) && (
                  <div className="flex justify-between">
                    <span>Tip</span>
                    <span>{money(bill.tipAmount)}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-black/10"></div>

              {/**
                * ⚠️ Figma-তে লেখা "Total Price(2)" — বন্ধনীর সংখ্যাটা
                * cart-এ কয়টা **পদ**, কয়টা ইউনিট নয়। দুটোর পার্থক্য
                * আছে: এক পদের তিনটে কপি থাকলে ওখানে "(1)" বসে।
                *
                * `cartItems.length` সেটাই দেয়, তাই আলাদা হিসাব লাগেনি।
                */}
              <div className="flex items-baseline justify-between gap-3 font-sora text-[14px] font-semibold text-black">
                <span>
                  Total Price
                  {cartItems.length > 0 && (
                    <span className="text-black/50">({cartItems.length})</span>
                  )}
                </span>
                <span className="text-[#2C6252]">
                  {bill ? money(bill.totalAmount) : `${currency} ${subtotal.toFixed(2)}`}
                </span>
              </div>

              {/* ⚠️ ফি এখনো জানা না গেলে Total-ও অসম্পূর্ণ। সেটা না
                  লিখলে গ্রাহক এই অঙ্কটাকেই চূড়ান্ত ধরে নিতেন। */}
              {deliveryFeePending && (
                <p className="text-[11px] text-gray-400 -mt-6">
                  Delivery charge is added once you enter your city and country.
                </p>
              )}

              {/* ⚠️ zone-এর বাইরের ঠিকানা — Confirm বোতামও একই সাথে
                  বন্ধ হয়ে যায় (renderPaymentMethodSection দ্রষ্টব্য)। */}
              {quoteError && (
                <div className="border border-red-200 bg-red-50 px-4 py-3 rounded -mt-6">
                  <p className="text-xs text-red-700">{quoteError}</p>
                </div>
              )}
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