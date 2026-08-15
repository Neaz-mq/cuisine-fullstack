import { NextResponse } from "next/server";
import { getRestaurantSettings } from "@/lib/get-settings";

/**
 * GET /api/settings — the public, unauthenticated slice of
 * RestaurantSettings that the customer-facing UI needs.
 *
 * ⚠️ ইচ্ছাকৃতভাবে সংকীর্ণ। এখানে কর হার বা taxable toggle গুলো নেই,
 * কারণ client কখনো টাকার হিসাব করে না — সে /api/checkout/quote-এ
 * cart পাঠিয়ে তৈরি বিল ফেরত পায়। যা দেখানোর জন্য দরকার শুধু সেটুকুই
 * বেরোয়।
 */
export async function GET() {
  const settings = await getRestaurantSettings();

  return NextResponse.json({
    timezone: settings.timezone,
    kitchenOpenHour: settings.kitchenOpenHour,
    kitchenCloseHour: settings.kitchenCloseHour,

    currency: settings.currency,

    // বকশিশের button গুলো আঁকতে লাগে। tipEnabled false হলে খালি array
    // পাঠানো হয় — client-এ দুটো আলাদা শর্ত লিখতে না হয়, আর UI নিজে
    // থেকেই অদৃশ্য থাকে।
    tipEnabled: settings.tipEnabled,
    tipPresetPercents: settings.tipEnabled ? settings.tipPresetPercents : [],
  });
}
