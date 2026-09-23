import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { offerSchema } from "@/lib/validations/offer";
import { buildOfferData } from "@/lib/offer-admin";

/**
 * POST /api/admin/offers — "Create Offer" / "Add Offer" on /admin/offers.
 *
 * Same "marketing" scope as the rest of the Offers section (OWNER and
 * MANAGER). The checks live in buildOfferData (src/lib/offer-admin.ts).
 */
export async function POST(request: Request) {
  const authResult = await requireApiScope("marketing");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(request, offerSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const built = await buildOfferData(parsed, null);
    if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });

    const offer = await prisma.productOffer.create({ data: built.data, select: { id: true } });
    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/offers error:", error);
    return NextResponse.json({ error: "Couldn't save the offer. Please try again." }, { status: 500 });
  }
}
