import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { transactionMethodsSchema } from "@/lib/validations/transaction-method";

/**
 * PATCH /api/admin/transaction-methods
 *
 * Payment/Shipping Summary কার্ডের "Manage Methods" modal যেখানে পাঠায়।
 *
 * ⚠️ POST নয়, PATCH — কিছু তৈরি হচ্ছে না, আগে থেকেই থাকা মাধ্যমগুলোর
 * সেটিং বদলাচ্ছে। কেন নতুন মাধ্যম তৈরি করা যায় না, তার কারণ
 * src/lib/transaction-methods.ts-এর মাথায় লেখা আছে।
 *
 * ⚠️ scope "refunds" — /admin/payment পাতার layout যা চায়, ঠিক সেটাই।
 */
export async function PATCH(req: NextRequest) {
  const authResult = await requireApiScope("refunds");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(req, transactionMethodsSchema);
  if (parsed instanceof NextResponse) return parsed;

  /**
   * ⚠️ পুরো তালিকাটা একটা transaction-এ — অর্ধেক বদল সংরক্ষিত হওয়ার
   * সুযোগ নেই। "COD বন্ধ করে Online চালু" দুটো আলাদা লেখা হলে মাঝখানে
   * ব্যর্থ হলে দুটোই বন্ধ অবস্থায় থেকে যেত, অর্থাৎ checkout-এ কোনো
   * অপশনই না — ঠিক যেটা schema-র refine আটকাতে চায়।
   */
  await prisma.$transaction(
    parsed.methods.map((method) =>
      prisma.transactionMethod.upsert({
        where: { kind_code: { kind: parsed.kind, code: method.code } },
        create: {
          kind: parsed.kind,
          code: method.code,
          label: method.label,
          // shipping-এ toggle নেই, তাই সেখানে সবসময় চালু।
          enabled: parsed.kind === "PAYMENT" ? method.enabled : true,
        },
        update: {
          label: method.label,
          enabled: parsed.kind === "PAYMENT" ? method.enabled : true,
        },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
