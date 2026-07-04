import { NextResponse } from "next/server";
import { getRestaurantSettings } from "@/lib/get-settings";

export async function GET() {
  const settings = await getRestaurantSettings();
  return NextResponse.json({
    timezone: settings.timezone,
    kitchenOpenHour: settings.kitchenOpenHour,
    kitchenCloseHour: settings.kitchenCloseHour,
  });
}