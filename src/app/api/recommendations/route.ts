// src/app/api/recommendations/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRecommendationsForUser } from "@/lib/recommendations";

export async function GET() {
  try {
    const session = await auth();
    let userId = session?.user?.id ?? null;

    // Profile Details → "Product Recommendations" switched off: the same
    // popular picks everyone gets, nothing based on their own orders.
    if (userId) {
      const prefs = await prisma.user.findUnique({ where: { id: userId }, select: { notifyRecommendations: true } });
      if (prefs && !prefs.notifyRecommendations) userId = null;
    }

    const recommendations = await getRecommendationsForUser(userId);
    return NextResponse.json(recommendations);
  } catch (error) {
    console.error("GET /api/recommendations error:", error);
    // Recommendations are a nice-to-have, not critical path — fail soft
    // with an empty result rather than a 500 the UI has to handle specially.
    return NextResponse.json({ personalized: false, orderAgain: [], recommended: [] });
  }
}