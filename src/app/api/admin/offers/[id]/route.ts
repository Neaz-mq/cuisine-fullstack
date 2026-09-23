import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { offerSchema } from "@/lib/validations/offer";
import { buildOfferData } from "@/lib/offer-admin";
import { offerStatus } from "@/lib/product-offers";

/**
 * PATCH /api/admin/offers/[id] — "Edit" on an offer card.
 *
 * The dish can't be swapped: an offer's orders (OrderItem.offerId) belong
 * to that dish. To discount a different dish, remove this offer and create
 * a new one.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiScope("marketing");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const parsed = await parseBody(request, offerSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const existing = await prisma.productOffer.findUnique({
      where: { id },
      select: { id: true, startsAt: true, menuItemId: true },
    });
    if (!existing) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    if (existing.menuItemId !== parsed.menuItemId) {
      return NextResponse.json(
        { error: "An offer's product can't be changed. Remove it and create a new one." },
        { status: 400 }
      );
    }

    const built = await buildOfferData(parsed, existing);
    if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });

    await prisma.productOffer.update({ where: { id }, data: built.data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/admin/offers/[id] error:", error);
    return NextResponse.json({ error: "Couldn't save the offer. Please try again." }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/offers/[id] — "Remove" on an offer card.
 *
 *   running   → ends now (endsAt = now). The dish goes back to its normal
 *               price at once, and the offer stays under "Ended" with its
 *               order count.
 *   scheduled → deleted; it never ran, so there is nothing to keep.
 *   ended     → deleted for good. Orders keep what they were charged —
 *               OrderItem.price/originalPrice — only the link is cleared.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiScope("marketing");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  try {
    const offer = await prisma.productOffer.findUnique({
      where: { id },
      select: { startsAt: true, endsAt: true },
    });
    if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });

    const now = new Date();
    if (offerStatus(offer, now) === "active") {
      await prisma.productOffer.update({ where: { id }, data: { endsAt: now } });
      return NextResponse.json({ result: "ended" });
    }

    await prisma.productOffer.delete({ where: { id } });
    return NextResponse.json({ result: "deleted" });
  } catch (error) {
    console.error("DELETE /api/admin/offers/[id] error:", error);
    return NextResponse.json({ error: "Couldn't remove the offer. Please try again." }, { status: 500 });
  }
}
