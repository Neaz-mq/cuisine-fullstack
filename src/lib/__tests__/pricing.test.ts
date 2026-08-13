import { describe, it, expect } from "vitest";
import { calculateOrderPricing, resolveTaxRate, type PricingSettings } from "@/lib/pricing";
import { toStripeMinorUnits, toMoney, extractInclusiveTax } from "@/lib/money";

/**
 * src/lib/__tests__/pricing.test.ts
 *
 * এই suite-এর মূল লক্ষ্য একটাই দাবি প্রমাণ করা: system-টা শুধু
 * বাংলাদেশে চলে না।
 *
 * তাই প্রতিটা describe block একটা বাস্তব দেশের নিয়ম — বাংলাদেশ (কর
 * দামের উপরে), জার্মানি (কর দামের ভেতরে, dine-in আর delivery-তে ভিন্ন
 * হার), যুক্তরাষ্ট্র (দশমিকযুক্ত হার + বকশিশ), জাপান (শূন্য-দশমিক
 * currency, বকশিশ নিষিদ্ধ), সংযুক্ত আরব আমিরাত (service charge)।
 *
 * এগুলো কাল্পনিক প্রান্তিক অবস্থা নয়। এর যেকোনো একটা ভাঙা মানে ওই
 * দেশে system-টা ভুল টাকা আদায় করছে।
 */

// বাংলাদেশ: ৫% VAT মেনুর দামের উপরে যোগ হয়, service charge নেই,
// বকশিশের চল নেই।
const BD: PricingSettings = {
  currency: "BDT",
  currencyMinorUnits: 2,
  taxEnabled: true,
  taxName: "VAT",
  taxMode: "EXCLUSIVE",
  taxRateDineIn: 0.05,
  taxRateDelivery: 0.05,
  serviceChargeRate: 0,
  serviceChargeTaxable: true,
  deliveryFeeFlat: 60,
  deliveryFeeTaxable: true,
  tipEnabled: false,
};

// জার্মানি: দাম কর-অন্তর্ভুক্ত। রেস্তোরাঁয় বসে খেলে ১৯%, নিয়ে গেলে ৭%।
const DE: PricingSettings = {
  ...BD,
  currency: "EUR",
  taxName: "MwSt",
  taxMode: "INCLUSIVE",
  taxRateDineIn: 0.19,
  taxRateDelivery: 0.07,
  deliveryFeeFlat: 0,
};

// যুক্তরাষ্ট্র: কর দামের উপরে, হার দশমিকযুক্ত, বকশিশ প্রায় বাধ্যতামূলক।
const US: PricingSettings = {
  ...BD,
  currency: "USD",
  taxName: "Sales Tax",
  taxMode: "EXCLUSIVE",
  taxRateDineIn: 0.08875,
  taxRateDelivery: 0.08875,
  deliveryFeeFlat: 5,
  tipEnabled: true,
};

// জাপান: ইয়েনের কোনো দশমিক নেই, দাম কর-অন্তর্ভুক্ত (১০%), আর বকশিশ
// দেওয়াটা ভদ্রতাবিরুদ্ধ।
const JP: PricingSettings = {
  ...BD,
  currency: "JPY",
  currencyMinorUnits: 0,
  taxName: "消費税",
  taxMode: "INCLUSIVE",
  taxRateDineIn: 0.1,
  taxRateDelivery: 0.1,
  deliveryFeeFlat: 0,
  tipEnabled: false,
};

const item = (price: number, quantity = 1) => ({ price, quantity });

describe("বাংলাদেশ — কর মেনুর দামের উপরে যোগ হয়", () => {
  it("dine-in order-এ subtotal-এর উপর ৫% VAT বসে", () => {
    const r = calculateOrderPricing({ orderType: "DINE_IN", items: [item(1000)] }, BD);

    expect(r.subtotal.toFixed(2)).toBe("1000.00");
    expect(r.taxAmount.toFixed(2)).toBe("50.00");
    expect(r.grandTotal.toFixed(2)).toBe("1050.00");
    expect(r.totalAmount.toFixed(2)).toBe("1050.00");
  });

  it("delivery order-এ delivery fee-ও করযোগ্য ভিত্তিতে ঢোকে", () => {
    const r = calculateOrderPricing({ orderType: "DELIVERY", items: [item(1000)] }, BD);

    // (1000 + 60) × 5% = 53, মাত্র 50 নয় — deliveryFeeTaxable: true.
    expect(r.deliveryFee.toFixed(2)).toBe("60.00");
    expect(r.taxAmount.toFixed(2)).toBe("53.00");
    expect(r.grandTotal.toFixed(2)).toBe("1113.00");
  });

  it("deliveryFeeTaxable বন্ধ থাকলে fee করের বাইরে থাকে", () => {
    const r = calculateOrderPricing(
      { orderType: "DELIVERY", items: [item(1000)] },
      { ...BD, deliveryFeeTaxable: false }
    );

    expect(r.taxAmount.toFixed(2)).toBe("50.00");
    expect(r.grandTotal.toFixed(2)).toBe("1110.00");
  });

  it("DINE_IN order-এ delivery fee বসে না", () => {
    const r = calculateOrderPricing({ orderType: "DINE_IN", items: [item(500)] }, BD);
    expect(r.deliveryFee.toFixed(2)).toBe("0.00");
  });

  it("কর ছাড়ের পরে বসে, আগে নয়", () => {
    const r = calculateOrderPricing(
      { orderType: "DINE_IN", items: [item(1000)], couponDiscount: 200 },
      BD
    );

    // 800-এর উপর ৫% = 40. ছাড়ের আগে বসালে 50 হতো, অর্থাৎ রেস্তোরাঁ
    // এমন টাকার উপর কর দিত যা সে কখনো পায়নি।
    expect(r.taxAmount.toFixed(2)).toBe("40.00");
    expect(r.grandTotal.toFixed(2)).toBe("840.00");
  });
});

describe("জার্মানি — কর দামের ভেতরেই", () => {
  it("INCLUSIVE mode-এ মোট বাড়ে না, শুধু করের অংশটা ঘোষণা করা হয়", () => {
    const r = calculateOrderPricing({ orderType: "DINE_IN", items: [item(119)] }, DE);

    // €১১৯-এ ১৯% অন্তর্ভুক্ত মানে কর €১৯ (১০০-এর উপর), €২২.৬১ নয়।
    expect(r.taxAmount.toFixed(2)).toBe("19.00");
    expect(r.grandTotal.toFixed(2)).toBe("119.00");
    expect(r.totalAmount.toFixed(2)).toBe("119.00");
  });

  it("একই খাবারে dine-in ১৯% আর delivery ৭%", () => {
    const dineIn = calculateOrderPricing({ orderType: "DINE_IN", items: [item(107)] }, DE);
    const delivery = calculateOrderPricing({ orderType: "DELIVERY", items: [item(107)] }, DE);

    expect(dineIn.taxAmount.toFixed(2)).toBe("17.08");
    expect(delivery.taxAmount.toFixed(2)).toBe("7.00");

    // মূল কথা: গ্রাহক দুই ক্ষেত্রেই ঠিক €১০৭ দেয়। শুধু রেস্তোরাঁ
    // সরকারকে কত দেবে সেটা বদলায়।
    expect(dineIn.grandTotal.toFixed(2)).toBe("107.00");
    expect(delivery.grandTotal.toFixed(2)).toBe("107.00");
  });
});

describe("যুক্তরাষ্ট্র — দশমিকযুক্ত হার ও বকশিশ", () => {
  it("8.875% হার সঠিকভাবে প্রয়োগ হয়", () => {
    const r = calculateOrderPricing({ orderType: "DINE_IN", items: [item(100)] }, US);
    expect(r.taxAmount.toFixed(2)).toBe("8.88");
  });

  it("শতাংশ-ভিত্তিক বকশিশ ছাড়-পরবর্তী subtotal-এর উপর, করের উপর নয়", () => {
    const r = calculateOrderPricing(
      { orderType: "DINE_IN", items: [item(100)], tipPercent: 20 },
      US
    );

    // $২০, $২১.৭৮ নয় — করের উপর বকশিশ মার্কিন প্রথা, বৈশ্বিক নিয়ম নয়।
    expect(r.tipAmount.toFixed(2)).toBe("20.00");
    expect(r.totalAmount.toFixed(2)).toBe("128.88");
  });

  it("বকশিশ কখনো করযোগ্য ভিত্তিতে ঢোকে না", () => {
    const withTip = calculateOrderPricing(
      { orderType: "DINE_IN", items: [item(100)], tipPercent: 20 },
      US
    );
    const withoutTip = calculateOrderPricing({ orderType: "DINE_IN", items: [item(100)] }, US);

    expect(withTip.taxAmount.toFixed(2)).toBe(withoutTip.taxAmount.toFixed(2));
  });

  it("grandTotal-এ বকশিশ থাকে না — ওটা বিল, বকশিশ বিলের অংশ নয়", () => {
    const r = calculateOrderPricing(
      { orderType: "DINE_IN", items: [item(100)], tipAmount: 15 },
      US
    );

    expect(r.grandTotal.toFixed(2)).toBe("108.88");
    expect(r.totalAmount.toFixed(2)).toBe("123.88");
  });
});

describe("জাপান — শূন্য-দশমিক currency ও বকশিশ বন্ধ", () => {
  it("ইয়েনে কোনো দশমিক থাকে না", () => {
    const r = calculateOrderPricing({ orderType: "DINE_IN", items: [item(1200)] }, JP);

    expect(r.grandTotal.toFixed(0)).toBe("1200");
    expect(r.taxAmount.toFixed(0)).toBe("109"); // 1200 × 0.1 / 1.1
  });

  it("Stripe-এ ¥1,200 যায় 1200 হয়ে, 120000 হয়ে নয়", () => {
    const r = calculateOrderPricing({ orderType: "DINE_IN", items: [item(1200)] }, JP);

    // পুরোনো `Math.round(price * 100)` এখানে ১০০ গুণ বেশি চার্জ করতো।
    expect(toStripeMinorUnits(r.totalAmount, JP.currencyMinorUnits)).toBe(1200);
  });

  it("KWD-তে গুণক ১০০০, ১০০ নয়", () => {
    expect(toStripeMinorUnits(toMoney("12.345"), 3)).toBe(12345);
  });

  it("tipEnabled বন্ধ থাকলে client যা-ই পাঠাক, বকশিশ শূন্য", () => {
    const r = calculateOrderPricing(
      { orderType: "DINE_IN", items: [item(1000)], tipAmount: 500, tipPercent: 20 },
      JP
    );

    // UI-তে বকশিশের ঘর লুকিয়ে রাখা যথেষ্ট নয় — server-ই শেষ কথা।
    expect(r.tipAmount.toFixed(0)).toBe("0");
    expect(r.totalAmount.toFixed(0)).toBe("1000");
  });
});

describe("Service charge", () => {
  const AE: PricingSettings = {
    ...BD,
    currency: "AED",
    taxName: "VAT",
    taxRateDineIn: 0.05,
    serviceChargeRate: 0.1,
    serviceChargeTaxable: true,
    deliveryFeeFlat: 0,
  };

  it("ছাড়-পরবর্তী subtotal-এর উপর বসে এবং নিজেও করযোগ্য", () => {
    const r = calculateOrderPricing({ orderType: "DINE_IN", items: [item(100)] }, AE);

    expect(r.serviceCharge.toFixed(2)).toBe("10.00");
    expect(r.taxAmount.toFixed(2)).toBe("5.50"); // (100 + 10) × 5%
    expect(r.grandTotal.toFixed(2)).toBe("115.50");
  });

  it("serviceChargeTaxable বন্ধ থাকলে করের ভিত্তি থেকে বাদ যায়", () => {
    const r = calculateOrderPricing(
      { orderType: "DINE_IN", items: [item(100)] },
      { ...AE, serviceChargeTaxable: false }
    );

    expect(r.taxAmount.toFixed(2)).toBe("5.00");
    expect(r.grandTotal.toFixed(2)).toBe("115.00");
  });
});

describe("Gift card ও loyalty point", () => {
  it("বিল থেকে বাদ যায়, কিন্তু করের হিসাব বদলায় না", () => {
    const r = calculateOrderPricing(
      { orderType: "DINE_IN", items: [item(1000)], giftCardRequested: 500 },
      BD
    );

    // gift card পরিশোধের একটা মাধ্যম, ছাড় নয় — বিক্রি এখনো ১০০০ টাকার,
    // তাই কর এখনো ৫০ টাকা।
    expect(r.taxAmount.toFixed(2)).toBe("50.00");
    expect(r.grandTotal.toFixed(2)).toBe("1050.00");
    expect(r.totalAmount.toFixed(2)).toBe("550.00");
  });

  it("বিলের চেয়ে বড় gift card বিল পর্যন্তই কাটে", () => {
    const r = calculateOrderPricing(
      { orderType: "DINE_IN", items: [item(100)], giftCardRequested: 5000 },
      BD
    );

    // প্রয়োগকৃত পরিমাণটাই ফেরত আসে, চাওয়া পরিমাণ নয় — caller এটাই
    // ledger-এ লিখবে, নইলে কার্ড থেকে ৫০০০ কেটে নেওয়া হতো।
    expect(r.giftCardAmount.toFixed(2)).toBe("105.00");
    expect(r.totalAmount.toFixed(2)).toBe("0.00");
  });

  it("gift card আর point মিলে বিল ঢেকে ফেললেও বকশিশ নিজের টাকাতেই যায়", () => {
    const r = calculateOrderPricing(
      {
        orderType: "DINE_IN",
        items: [item(100)],
        giftCardRequested: 1000,
        pointsRedeemedRequested: 1000,
        tipPercent: 10,
      },
      US
    );

    expect(r.giftCardAmount.toFixed(2)).toBe("108.88");
    expect(r.pointsRedeemedAmount.toFixed(2)).toBe("0.00");

    // পুরো বিল prepaid দিয়ে মেটার পরও বকশিশটা বাকি — কর্মীর প্রাপ্য
    // টাকা রেস্তোরাঁর নিজের gift card দিয়ে শোধ করা যাবে না।
    expect(r.tipAmount.toFixed(2)).toBe("10.00");
    expect(r.totalAmount.toFixed(2)).toBe("10.00");
  });

  it("point শুধু gift card-এর পরে যা বাকি ততটুকুই কাটে", () => {
    const r = calculateOrderPricing(
      {
        orderType: "DINE_IN",
        items: [item(1000)],
        giftCardRequested: 800,
        pointsRedeemedRequested: 500,
      },
      BD
    );

    expect(r.giftCardAmount.toFixed(2)).toBe("800.00");
    expect(r.pointsRedeemedAmount.toFixed(2)).toBe("250.00");
    expect(r.totalAmount.toFixed(2)).toBe("0.00");
  });
});

describe("Tier discount", () => {
  it("শতাংশটা coupon-পরবর্তী অবশিষ্টের উপর বসে, মূল subtotal-এর উপর নয়", () => {
    const r = calculateOrderPricing(
      // ১০০ টাকার order, ২০ টাকা coupon ছাড়, তারপর Gold-এর ৫%।
      { orderType: "DINE_IN", items: [item(100)], couponDiscount: 20, tierDiscountPercent: 5 },
      BD
    );

    // ৮০-এর ৫% = ৪, ১০০-এর ৫% = ৫ নয়। নইলে coupon আর tier perk একই
    // টাকার উপর দুবার ছাড় দিত।
    expect(r.tierDiscountAmount.toFixed(2)).toBe("4.00");
    expect(r.taxAmount.toFixed(2)).toBe("3.80"); // (100 − 20 − 4) × 5%
  });

  it("currency অনুযায়ী round হয় — ইয়েনে ভগ্নাংশ তৈরি হয় না", () => {
    // ৩৩৩৩ ইয়েনের ৩% = ৯৯.৯৯, যার অস্তিত্ব নেই। ১০০-তে round হওয়া চাই।
    const r = calculateOrderPricing(
      { orderType: "DINE_IN", items: [item(3333)], tierDiscountPercent: 3 },
      JP
    );

    expect(r.tierDiscountAmount.toFixed(0)).toBe("100");
    expect(r.tierDiscountAmount.decimalPlaces()).toBe(0);
  });

  it("শতাংশ না দিলে কোনো ছাড় নেই — guest checkout-এর স্বাভাবিক অবস্থা", () => {
    const r = calculateOrderPricing({ orderType: "DINE_IN", items: [item(100)] }, BD);
    expect(r.tierDiscountAmount.toFixed(2)).toBe("0.00");
  });
});

describe("ছাড়ের সীমা", () => {
  it("coupon পুরো subtotal খেয়ে ফেললে tier-এর জন্য কিছু বাকি থাকে না", () => {
    const r = calculateOrderPricing(
      { orderType: "DINE_IN", items: [item(100)], couponDiscount: 100, tierDiscountPercent: 8 },
      BD
    );

    expect(r.discountAmount.toFixed(2)).toBe("100.00");
    expect(r.tierDiscountAmount.toFixed(2)).toBe("0.00");
    expect(r.grandTotal.toFixed(2)).toBe("0.00");
  });

  it("মোট কখনো ঋণাত্মক হয় না", () => {
    const r = calculateOrderPricing(
      { orderType: "DINE_IN", items: [item(50)], couponDiscount: 999 },
      BD
    );

    expect(r.totalAmount.isNegative()).toBe(false);
    expect(r.totalAmount.toFixed(2)).toBe("0.00");
  });
});

describe("কর বন্ধ থাকা ও হার নির্বাচন", () => {
  it("taxEnabled false হলে হার শূন্য ধরা হয়, হার যা-ই থাকুক", () => {
    const r = calculateOrderPricing(
      { orderType: "DINE_IN", items: [item(1000)] },
      { ...BD, taxEnabled: false }
    );

    expect(r.taxAmount.toFixed(2)).toBe("0.00");
    expect(r.grandTotal.toFixed(2)).toBe("1000.00");
  });

  it("resolveTaxRate order type অনুযায়ী আলাদা হার দেয়", () => {
    expect(resolveTaxRate(DE, "DINE_IN").toFixed(5)).toBe("0.19000");
    expect(resolveTaxRate(DE, "DELIVERY").toFixed(5)).toBe("0.07000");
  });
});

describe("Snapshot ক্ষেত্রগুলো", () => {
  it("currency, নাম, হার আর mode ফলাফলের সাথেই ফেরত আসে", () => {
    const r = calculateOrderPricing({ orderType: "DINE_IN", items: [item(100)] }, DE);

    // এগুলো হুবহু Order row-তে লেখা হবে, যাতে settings বদলালেও পুরোনো
    // চালান অবিকৃত থাকে।
    expect(r.currency).toBe("EUR");
    expect(r.taxName).toBe("MwSt");
    expect(r.taxMode).toBe("INCLUSIVE");
    expect(r.taxRate.toFixed(5)).toBe("0.19000");
  });
});

describe("Float drift — যে কারণে পুরো কাজটা করা", () => {
  it("ধাপে ধাপে খরচ করা gift card ঠিক শূন্যে পৌঁছায়", () => {
    // Float-এ 50 − 19.99 − 12.35 − 17.66 = 1.77e-15, শূন্য নয়। ফলে
    // কার্ডটা চিরকাল "ব্যালেন্স আছে" দেখাতো।
    const balance = toMoney(50).minus(19.99).minus(12.35).minus(17.66);

    expect(balance.isZero()).toBe(true);
    expect(50 - 19.99 - 12.35 - 17.66).not.toBe(0); // পুরোনো আচরণ
  });

  it("অন্তর্ভুক্ত কর বের করার সূত্র যোগের সূত্র নয়", () => {
    // ১১৫-তে ১৫% অন্তর্ভুক্ত মানে কর ১৫, ১৭.২৫ নয়।
    expect(extractInclusiveTax(toMoney(115), toMoney(0.15)).toFixed(2)).toBe("15.00");
  });
});
