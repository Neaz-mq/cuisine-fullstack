import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildCheckoutProfile } from "@/lib/checkout-profile";

/**
 * GET /api/account/checkout-profile
 *
 * The signed-in customer's OWN details for pre-filling checkout: account
 * name and email, and the phone and address from their most recent
 * delivery order. Nothing about anyone else, so a session check is the
 * whole trust boundary (same as /api/loyalty/me). Guests get 401 and
 * simply see an empty form.
 *
 * Never cached — it's personal, and a shared device must not be served
 * someone else's address.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const userId = session.user.id;

    const [user, lastOrder] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, phone: true },
      }),
      prisma.order.findFirst({
        where: { userId, orderType: "DELIVERY" },
        orderBy: { createdAt: "desc" },
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          country: true,
          address: true,
          apartment: true,
          city: true,
          state: true,
          zip: true,
        },
      }),
    ]);
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json(buildCheckoutProfile(user, lastOrder), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[checkout-profile] failed:", error);
    return NextResponse.json({ error: "Couldn't load your details" }, { status: 500 });
  }
}
