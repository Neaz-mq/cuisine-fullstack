/**
 * src/lib/advance-order-to-preparing.ts
 *
 * Order-কে PREPARING-এ নিয়ে যায় এবং একই transaction-এ তার প্রতিটা line
 * item-এর recipe ingredient (MenuItemIngredient) InventoryItem.currentStock
 * থেকে কমায় — প্রতি ingredient-এ একটা করে StockMovement (ORDER_DEDUCTION)
 * ledger row লিখে।
 *
 * mark-order-delivered.ts-এর মতোই গঠন: একটা status transition আর তার
 * সাথে জড়িত একটা side effect, যেগুলো একসাথে সফল বা একসাথে ব্যর্থ হতে
 * হবে — নিজস্ব file-এ রাখা হয়েছে যাতে admin status dropdown
 * (PATCH /api/orders/[id]) আর assign-rider দুই জায়গাতেই এক
 * implementation ব্যবহার হয়।
 *
 * দুবার deduct হওয়া ঠেকানোর কাজটা এখন Order.stockDeductedAt-এ atomic
 * claim দিয়ে হয়, StockMovement আগে থেকে আছে কিনা সেটা পড়ে নয়। আগের
 * পদ্ধতিতে check-টা transaction শুরুর *আগে* হতো, ফলে দুটো একসাথে আসা
 * request দুজনেই "হয়নি" দেখতো আর দুবার deduct করতো। check-টা ভেতরে
 * সরালেও যথেষ্ট হতো না — Postgres-এর default READ COMMITTED isolation-এ
 * একটা transaction অন্যটার এখনো commit-না-হওয়া row দেখতেই পায় না।
 * updateMany-র affected-row count-ই একমাত্র নির্ভরযোগ্য guard, ঠিক
 * যেভাবে consumeCoupon আর redeemGiftCard কাজ করে।
 */
import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/order-state-machine";

type AdvanceResult =
  | { ok: true; order: { id: string; status: string }; deducted: boolean }
  | {
      ok: false;
      error:
        | "Order not found"
        | "Cannot prepare a cancelled order"
        | "This order cannot be moved to preparing from its current status";
    };

export async function advanceOrderToPreparing(orderId: string): Promise<AdvanceResult> {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      items: {
        select: {
          quantity: true,
          menuItem: {
            select: {
              ingredients: {
                select: { inventoryItemId: true, quantityRequired: true },
              },
            },
          },
        },
      },
    },
  });

  if (!existingOrder) return { ok: false, error: "Order not found" };
  if (existingOrder.status === "CANCELLED") {
    return { ok: false, error: "Cannot prepare a cancelled order" };
  }
  // ইতিমধ্যে PREPARING থাকলে canTransition true দেয় (same-status no-op),
  // তাই dropdown-এ একই মান আবার select করলে error আসবে না — নিচের claim
  // শুধু count 0 পেয়ে চুপচাপ এড়িয়ে যাবে।
  if (!canTransition(existingOrder.status, "PREPARING")) {
    return {
      ok: false,
      error: "This order cannot be moved to preparing from its current status",
    };
  }

  // এক order-এর দুটো ভিন্ন menu item একই ingredient ব্যবহার করতে পারে
  // (যেমন দুটো পদেই চাল) — তাই আগে ingredient ধরে যোগ করে নেওয়া, যাতে
  // ledger-এ প্রতি ingredient-এ একটাই row যায়, প্রতি menu item-এ নয়।
  const required = new Map<string, number>();
  for (const item of existingOrder.items) {
    for (const ingredient of item.menuItem.ingredients) {
      const needed = ingredient.quantityRequired * item.quantity;
      required.set(
        ingredient.inventoryItemId,
        (required.get(ingredient.inventoryItemId) ?? 0) + needed
      );
    }
  }

  // id দিয়ে sort — সব transaction একই ক্রমে InventoryItem row lock করলে
  // দুটো order একসাথে PREPARING হলেও deadlock হবে না। আগে Map-এর
  // insertion order ব্যবহার হতো, যেটা order-ভেদে আলাদা: order A
  // চাল→তেল lock করছে আর order B তেল→চাল — Postgres তখন একটাকে kill
  // করে দিত। cancel-order.ts-এর returnStock একই ক্রম ব্যবহার করে।
  const sortedRequirements = [...required.entries()].sort(([a], [b]) => a.localeCompare(b));

  const result = await prisma.$transaction(
    async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: { status: "PREPARING" },
        select: { id: true, status: true },
      });

      // Deduction-এর একমাত্র আসল guard। যে request count 1 পায় সেটাই
      // deduct করার অধিকার পায়; বাকিরা 0 পেয়ে চুপচাপ এড়িয়ে যায়। status
      // update উপরে থাকায় দ্বিতীয় request-ও PREPARING-ই দেখবে, শুধু
      // stock আর কমাবে না — অর্থাৎ ব্যবহারকারীর কাছে ফলাফল একই, ভেতরে
      // হিসাব ঠিক থাকে।
      const claim = await tx.order.updateMany({
        where: { id: orderId, stockDeductedAt: null },
        data: { stockDeductedAt: new Date() },
      });

      if (claim.count !== 1 || sortedRequirements.length === 0) {
        return { order, deducted: false };
      }

      for (const [inventoryItemId, quantityChange] of sortedRequirements) {
        const updatedItem = await tx.inventoryItem.update({
          where: { id: inventoryItemId },
          data: { currentStock: { decrement: quantityChange } },
        });

        // currentStock ঋণাত্মক হতে দেওয়া হয়, order আটকে দেওয়া হয় না —
        // order PREPARING হওয়া মানে রান্নাঘর ইতিমধ্যে ingredient ব্যবহার
        // করছে, ledger যাই বলুক। ঋণাত্মক stock low-stock dashboard-এর
        // জন্য একটা সংকেত (বাসি reorderThreshold, হিসাব-বহির্ভূত wastage,
        // বা মিসিং PURCHASE entry), রান্না থামানোর কারণ নয়।
        await tx.stockMovement.create({
          data: {
            type: "ORDER_DEDUCTION",
            quantityChange: -quantityChange,
            resultingStock: updatedItem.currentStock,
            inventoryItemId,
            orderId,
          },
        });
      }

      return { order, deducted: true };
    },
    // Default 5s যথেষ্ট নয়: প্রতি ingredient-এ ২টা sequential query, আর
    // Supabase pooler-এ latency বেশি। ১০ ingredient-এর order মানে ২০টা
    // round trip, পুরোটা সময় row lock ধরে রেখে। timeout হলে status
    // change-ও rollback হয়ে যেতো, অর্থাৎ kitchen board-এ order আটকে
    // থাকতো কোনো ব্যাখ্যা ছাড়াই।
    { timeout: 15000 }
  );

  return { ok: true, order: result.order, deducted: result.deducted };
}