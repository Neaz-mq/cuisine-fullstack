import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { earnRuleSchema } from "@/lib/validations/loyalty";
import { getEarnRules } from "@/lib/loyalty-config";

/**
 * POST /api/admin/loyalty/earn-rules — add a "Target Point".
 *
 * Changing how customers earn is a business setting, so it needs the
 * "settings" scope (owner/manager), not just "loyalty" (cashiers have that
 * to adjust a customer's points).
 *
 * A new rule is saved inactive — "Apply" switches to it — unless there is
 * no active rule at all, in which case it becomes active straight away.
 */
export async function POST(request: Request) {
  const auth = await requireApiScope("settings");
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(request, earnRuleSchema);
  if (parsed instanceof NextResponse) return parsed;

  const existing = await getEarnRules();
  const duplicate = existing.some(
    (rule) => rule.spendAmount.equals(parsed.spendAmount) && rule.points === parsed.points
  );
  if (duplicate) {
    return NextResponse.json({ error: "This target already exists." }, { status: 409 });
  }

  const rule = await prisma.loyaltyEarnRule.create({
    data: {
      spendAmount: parsed.spendAmount,
      points: parsed.points,
      isActive: !existing.some((r) => r.isActive),
    },
    select: { id: true },
  });

  return NextResponse.json({ id: rule.id }, { status: 201 });
}
