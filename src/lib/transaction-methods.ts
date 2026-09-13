import { prisma } from "@/lib/prisma";

/**
 * src/lib/transaction-methods.ts
 *
 * চেকআউটে কোন মাধ্যমগুলো দেখা যাবে আর কী নামে — কোডের দিক থেকে তার
 * একমাত্র সংজ্ঞা।
 *
 * ⚠️ তালিকাটা কোডে, database-এ নয়। নতুন একটা মাধ্যম সত্যিই কাজ করতে
 * হলে চারটে জিনিস লাগে: checkout-এ অপশন, টাকা নেওয়ার integration, টাকা
 * এসেছে জানার পথ, আর ফেরতের পথ। database-এ একটা সারি লিখে এর একটাও
 * হয় না। তাই admin যা বদলাতে পারেন তা হলো **নাম** আর **চালু/বন্ধ** —
 * ঠিক যেমন Shopify বা WooCommerce-এ হয়।
 *
 * DB-র `TransactionMethod` সারি কেবল এই ডিফল্টগুলোর উপর admin-এর
 * সিদ্ধান্ত চাপায়। সারি না থাকলে ডিফল্টই চলে, তাই খালি টেবিল মানে
 * "সব চালু, কোডের নামেই"।
 */

export type PaymentCode = "ONLINE" | "COD";
export type ShippingCode = "UBER_EATS" | "FOOD_PANDA" | "OWN_DELIVERY";

export type TransactionMethod = {
  code: string;
  label: string;
  description: string;
  enabled: boolean;
};

/**
 * ⚠️ `description` admin-এর হাতে নেই, ইচ্ছাকৃতভাবে।
 *
 * ওটা মাধ্যমটা আসলে **কীভাবে কাজ করে** তা বলে ("কার্ড দিয়ে এখনই",
 * "দরজায় নগদ") — সেটা কোডের সত্য, রুচির ব্যাপার নয়। বদলানোর সুযোগ
 * দিলে কেউ COD-র নিচে "Pay securely by card" লিখে রাখতে পারতেন।
 */
const PAYMENT_DEFAULTS: Record<PaymentCode, Omit<TransactionMethod, "code">> = {
  ONLINE: {
    label: "Online Payment",
    description: "Pay securely using a card or mobile wallet.",
    enabled: true,
  },
  COD: {
    label: "Cash on Delivery",
    description: "Pay with cash upon delivery.",
    enabled: true,
  },
};

const SHIPPING_DEFAULTS: Record<ShippingCode, Omit<TransactionMethod, "code">> = {
  UBER_EATS: { label: "Uber Eats", description: "", enabled: true },
  FOOD_PANDA: { label: "Food Panda", description: "", enabled: true },
  OWN_DELIVERY: { label: "Our Own Delivery", description: "", enabled: true },
};

export const PAYMENT_CODES = Object.keys(PAYMENT_DEFAULTS) as PaymentCode[];
export const SHIPPING_CODES = Object.keys(SHIPPING_DEFAULTS) as ShippingCode[];

export function isPaymentCode(value: unknown): value is PaymentCode {
  return typeof value === "string" && (PAYMENT_CODES as string[]).includes(value);
}

export function isShippingCode(value: unknown): value is ShippingCode {
  return typeof value === "string" && (SHIPPING_CODES as string[]).includes(value);
}

/**
 * ডিফল্ট + admin-এর সিদ্ধান্ত মিলিয়ে চূড়ান্ত তালিকা।
 *
 * ⚠️ ক্রমটা কোডের তালিকার ক্রম, DB-র নয় — checkout-এ অপশনের ক্রম
 * হঠাৎ বদলে গেলে যিনি অভ্যাসে দ্বিতীয়টায় ক্লিক করেন তিনি ভুল মাধ্যম
 * বেছে ফেলতেন।
 *
 * ⚠️ DB-তে অচেনা `code` থাকলে (যেমন পুরনো পরীক্ষার সারি) সেটা চুপচাপ
 * বাদ যায়। কোডে যে মাধ্যম নেই, সেটা দেখানোর মানে হয় না।
 */
export async function getTransactionMethods(): Promise<{
  payment: TransactionMethod[];
  shipping: TransactionMethod[];
}> {
  /**
   * ⚠️ database-এ পৌঁছনো না গেলে পাতা ভাঙে না, ডিফল্টেই চলে।
   *
   * এই তালিকাটা checkout-এর একটা সহায়ক সেটিং, মূল তথ্য নয় — অর্ডারের
   * দাম বা পদ নয়। DB এক মুহূর্তের জন্য নাগালের বাইরে গেলে গ্রাহককে
   * একটা error পাতা দেখানোর চেয়ে কোডের ডিফল্ট নাম আর "সব চালু" ধরে
   * নেওয়াই ভালো — তাতে অন্তত অর্ডারটা দেওয়া যায়।
   *
   * ⚠️ তবে server-এর পাহারা (isPaymentMethodEnabled) এতে শিথিল হয় না:
   * ওটাও একই ডিফল্টে ফিরবে, অর্থাৎ বন্ধ করা মাধ্যম আবার চালু দেখাবে।
   * সেটা মেনে নেওয়া হয়েছে ইচ্ছাকৃতভাবে — DB ছাড়া অর্ডার তৈরিই হয় না,
   * তাই এই অবস্থায় ভুল মাধ্যমে অর্ডার ঢোকার সুযোগও নেই।
   */
  let overrides: { kind: string; code: string; label: string; enabled: boolean }[] = [];
  try {
    overrides = await prisma.transactionMethod.findMany({
      select: { kind: true, code: true, label: true, enabled: true },
    });
  } catch (error) {
    console.error("Failed to load transaction method settings; using defaults", error);
  }

  const find = (kind: "PAYMENT" | "SHIPPING", code: string) =>
    overrides.find((row) => row.kind === kind && row.code === code);

  const payment = PAYMENT_CODES.map((code) => {
    const override = find("PAYMENT", code);
    return {
      code,
      description: PAYMENT_DEFAULTS[code].description,
      label: override?.label?.trim() || PAYMENT_DEFAULTS[code].label,
      enabled: override?.enabled ?? PAYMENT_DEFAULTS[code].enabled,
    };
  });

  const shipping = SHIPPING_CODES.map((code) => {
    const override = find("SHIPPING", code);
    return {
      code,
      description: SHIPPING_DEFAULTS[code].description,
      label: override?.label?.trim() || SHIPPING_DEFAULTS[code].label,
      // ⚠️ shipping-এ toggle নেই (schema-র মন্তব্য দ্রষ্টব্য), তাই সবসময়
      // true — DB-তে ভুল করে false বসে থাকলেও checkout ভাঙে না।
      enabled: true,
    };
  });

  return { payment, shipping };
}

/**
 * একটা payment মাধ্যম এই মুহূর্তে গ্রহণযোগ্য কিনা — server-side পাহারা।
 *
 * ⚠️ UI থেকে অপশনটা লুকানোই যথেষ্ট নয়। checkout-এর API-তে যে কেউ সরাসরি
 * request পাঠাতে পারেন, তাই "COD বন্ধ" সিদ্ধান্তটা server-এও প্রয়োগ
 * করতে হয় — নাহলে বন্ধ করা মাধ্যমে অর্ডার আসতেই থাকত।
 */
export async function isPaymentMethodEnabled(code: PaymentCode): Promise<boolean> {
  const { payment } = await getTransactionMethods();
  return payment.some((method) => method.code === code && method.enabled);
}
