// src/app/api/recommendations/pairs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPairsWellWith } from "@/lib/recommendations";

// POST { cartItemIds: string[] } -> RecommendedMenuItem[]
// POST (not GET) because the cart contents are the query itself and can
// exceed a comfortable URL length; also keeps cart contents out of server
// access logs.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const cartItemIds = Array.isArray(body?.cartItemIds)
      ? body.cartItemIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (cartItemIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const items = await getPairsWellWith(cartItemIds, 4);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("POST /api/recommendations/pairs error:", error);
    // Upsell is a nice-to-have, not critical path — fail soft with an
    // empty result rather than a 500 the cart UI would have to handle.
    return NextResponse.json({ items: [] });
  }
}