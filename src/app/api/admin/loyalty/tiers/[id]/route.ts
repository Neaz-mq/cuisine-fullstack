import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { tierSchema } from "@/lib/validations/loyalty";
import { getLoyaltyTierRows, tierClash } from "@/lib/loyalty-config";
import { isUniqueConstraintError } from "@/lib/prisma-errors";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/loyalty/tiers/[id] — edit a ranking.
 *
 * The base ranking (0 points) keeps 0: every customer has to land somewhere.
 * Its name and perks can still change. Tiers are worked out from points on
 * every read, so an edit applies to every customer at once — nothing to
 * back-fill.
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApiScope("settings");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const parsed = await parseBody(request, tierSchema);
  if (parsed instanceof NextResponse) return parsed;

  const rows = await getLoyaltyTierRows();
  const current = rows.find((row) => row.id === id);
  if (!current) return NextResponse.json({ error: "Ranking not found." }, { status: 404 });

  if (current.minPoints === 0 && parsed.minPoints !== 0) {
    return NextResponse.json(
      { error: "The starting ranking always begins at 0 points." },
      { status: 409 }
    );
  }
  if (current.minPoints !== 0 && parsed.minPoints === 0) {
    return NextResponse.json(
      { error: "0 points is the starting ranking. Pick a higher number." },
      { status: 409 }
    );
  }
  const clash = tierClash(rows, parsed, id);
  if (clash) return NextResponse.json({ error: clash }, { status: 409 });

  try {
    await prisma.loyaltyTier.update({
      where: { id },
      data: {
        name: parsed.name,
        minPoints: parsed.minPoints,
        discountPercent: parsed.discountPercent,
        bonusPercent: parsed.bonusPercent,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "A ranking with this name or points already exists." }, { status: 409 });
    }
    throw error;
  }
}

/** DELETE — customers in it simply fall to the ranking below. Not the base one. */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireApiScope("settings");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const tier = await prisma.loyaltyTier.findUnique({ where: { id }, select: { minPoints: true } });
  if (!tier) return NextResponse.json({ error: "Ranking not found." }, { status: 404 });
  if (tier.minPoints === 0) {
    return NextResponse.json(
      { error: "The starting ranking can't be deleted — every customer needs one." },
      { status: 409 }
    );
  }

  await prisma.loyaltyTier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
