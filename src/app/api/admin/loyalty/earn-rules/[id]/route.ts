import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { earnRulePatchSchema } from "@/lib/validations/loyalty";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/loyalty/earn-rules/[id]
 *   { apply: true }              → make this the active rule (only one is)
 *   { spendAmount, points }      → edit the numbers
 *
 * Editing the active rule changes points for orders delivered from now on;
 * points already given are never recalculated.
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApiScope("settings");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const parsed = await parseBody(request, earnRulePatchSchema);
  if (parsed instanceof NextResponse) return parsed;

  const rule = await prisma.loyaltyEarnRule.findUnique({ where: { id }, select: { id: true } });
  if (!rule) return NextResponse.json({ error: "Target not found." }, { status: 404 });

  if ("apply" in parsed) {
    // One transaction, so there is never a moment with two active rules
    // (or none) for an order being delivered at the same time.
    await prisma.$transaction([
      prisma.loyaltyEarnRule.updateMany({ where: { isActive: true, NOT: { id } }, data: { isActive: false } }),
      prisma.loyaltyEarnRule.update({ where: { id }, data: { isActive: true } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  const duplicate = await prisma.loyaltyEarnRule.findFirst({
    where: { spendAmount: parsed.spendAmount, points: parsed.points, NOT: { id } },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "This target already exists." }, { status: 409 });
  }

  await prisma.loyaltyEarnRule.update({
    where: { id },
    data: { spendAmount: parsed.spendAmount, points: parsed.points },
  });
  return NextResponse.json({ ok: true });
}

/** DELETE — only a rule that isn't in use. Apply another one first. */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireApiScope("settings");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const rule = await prisma.loyaltyEarnRule.findUnique({ where: { id }, select: { isActive: true } });
  if (!rule) return NextResponse.json({ error: "Target not found." }, { status: 404 });
  if (rule.isActive) {
    return NextResponse.json(
      { error: "This target is in use. Apply another one before deleting it." },
      { status: 409 }
    );
  }

  await prisma.loyaltyEarnRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
