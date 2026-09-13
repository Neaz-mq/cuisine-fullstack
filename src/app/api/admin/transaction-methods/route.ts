import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { transactionMethodSchema } from "@/lib/validations/transaction-method";

/**
 * POST /api/admin/transaction-methods
 *
 * Payment/Shipping Summary কার্ডের "Add Method" modal যেখানে পাঠায়।
 *
 * ⚠️ scope "refunds" — /admin/payment পাতার layout যা চায়, ঠিক সেটাই।
 * টাকার পাতার কোনো কিছু বদলানোর অধিকার আর অর্ডার এগিয়ে নেওয়ার অধিকার
 * এই অ্যাপে আলাদা।
 *
 * ⚠️ নামটা আগে থেকেই থাকলে 409, আর সেটা চুপচাপ সফল বলে দেখানো হয় না।
 * "Banking" দুবার যোগ করে দুটো একই সারি দেখার চেয়ে "এটা আগে থেকেই আছে"
 * পড়া ভালো।
 */
export async function POST(req: NextRequest) {
  const authResult = await requireApiScope("refunds");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(req, transactionMethodSchema);
  if (parsed instanceof NextResponse) return parsed;

  const existing = await prisma.transactionMethod.findUnique({
    where: { kind_name: { kind: parsed.kind, name: parsed.name } },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ error: "That method already exists." }, { status: 409 });
  }

  const created = await prisma.transactionMethod.create({
    data: { kind: parsed.kind, name: parsed.name },
    select: { id: true, name: true },
  });

  return NextResponse.json(created, { status: 201 });
}
