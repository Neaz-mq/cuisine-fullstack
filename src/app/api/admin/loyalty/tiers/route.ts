import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { tierSchema } from "@/lib/validations/loyalty";
import { getLoyaltyTierRows, tierClash } from "@/lib/loyalty-config";
import { isUniqueConstraintError } from "@/lib/prisma-errors";

/**
 * POST /api/admin/loyalty/tiers — add a "Customer Ranking".
 *
 * A ranking only needs the points it STARTS at; it ends where the next one
 * starts, so rankings can never overlap or leave a gap. 0 belongs to the
 * base ranking, which always exists.
 */
export async function POST(request: Request) {
  const auth = await requireApiScope("settings");
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(request, tierSchema);
  if (parsed instanceof NextResponse) return parsed;

  // Makes sure the base tier exists before a new one is added next to it.
  const rows = await getLoyaltyTierRows();
  const clash = tierClash(rows, parsed, null);
  if (clash) return NextResponse.json({ error: clash }, { status: 409 });

  try {
    const tier = await prisma.loyaltyTier.create({
      data: {
        name: parsed.name,
        minPoints: parsed.minPoints,
        discountPercent: parsed.discountPercent,
        bonusPercent: parsed.bonusPercent,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: tier.id }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "A ranking with this name or points already exists." }, { status: 409 });
    }
    throw error;
  }
}
