import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { restockInventoryItemSchema } from "@/lib/validations/inventory";

/**
 * POST /api/admin/inventory/[id]/restock
 *
 * Figma-র "Items Restock" modal — মাল এলো, stock বাড়াও।
 *
 * ── কেন আলাদা route, `/movements` নয় ────────────────────────────────
 *
 * ওই route-টা **manual correction**-এর জন্য: WASTAGE, ADJUSTMENT,
 * RETURN — তিনটেই এমন ঘটনা যেগুলো ব্যাখ্যা দাবি করে, তাই সেখানে
 * `note` বাধ্যতামূলক। মাল আসা তার উল্টো: সেটাই স্বাভাবিক ঘটনা।
 *
 * তাছাড়া restock দুটো বাড়তি কাজ করে যা movements করে না — দাম আর
 * সরবরাহকারী হালনাগাদ করা। ওগুলো ওখানে ঢোকালে "একটা movement লেখা"
 * route-টা "একটা উপকরণ সম্পাদনা করা" route-ও হয়ে যেত।
 *
 * ⚠️ `recordStockMovement` helper-টাও ব্যবহার করা হয়নি — ওর type
 * signature ইচ্ছাকৃতভাবে PURCHASE বাদ দিয়ে রেখেছে (`ManualMovementType`),
 * কারণ PURCHASE সাধারণত PurchaseOrder receive করলে লেখা হয়। এখানে
 * transaction-টা হাতে লেখা, কিন্তু নিয়ম হুবহু একই: stock আর movement
 * সবসময় একসাথে, এক transaction-এ।
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const parsed = await parseBody(req, restockInventoryItemSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { quantityReceived, costPerUnit, supplierId, note } = parsed;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.update({
        where: { id },
        data: {
          currentStock: { increment: quantityReceived },
          // ⚠️ শুধু পাঠালে তবেই — না পাঠালে পুরনো দাম/সরবরাহকারী
          // অক্ষত থাকে। `costPerUnit: 0` কিন্তু বৈধ মান (বিনামূল্যে
          // পাওয়া জিনিস), তাই `!== undefined`, `||` নয়।
          ...(costPerUnit !== undefined ? { costPerUnit } : {}),
          ...(supplierId ? { supplierId } : {}),
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          type: "PURCHASE",
          quantityChange: quantityReceived,
          // ⚠️ update-এর **পরের** মান — StockMovement.resultingStock-এর
          // মানেই "এই নড়াচড়ার পর কত ছিল", আর সেটাই ইতিহাস পড়ার সময়
          // মিলিয়ে দেখা যায়।
          resultingStock: item.currentStock,
          note: note || "Restocked from the Inventory screen",
          inventoryItemId: id,
          createdById: authResult.user.id,
        },
      });

      return { item, movement };
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
  }
}
