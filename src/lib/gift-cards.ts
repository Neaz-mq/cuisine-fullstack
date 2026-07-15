import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import crypto from "crypto";

/**
 * src/lib/gift-cards.ts
 *
 * Core gift-card logic, mirroring the Coupon v2 design in
 * order-checkout-shared.ts wherever the two concepts overlap (server-side
 * validation before an order is created, an atomic claim inside the same
 * transaction as order creation, a race-safe error the API routes can
 * catch). See the GiftCard/GiftCardTransaction models in
 * prisma/schema.prisma for the full data-model rationale.
 *
 * Key difference from a coupon: a gift card carries a real balance that's
 * spent down over one or more redemptions (partial redemption is
 * expected — "pay the rest with card"), rather than a single all-or-
 * nothing discount rule.
 */

// Human-friendly, unambiguous alphabet — no 0/O or 1/I/L, so a code read
// aloud over the phone or typed from a printed receipt is never confused
// between similar-looking characters.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_SEGMENT_LENGTH = 4;
const CODE_SEGMENTS = 3;

function randomSegment(length: number): string {
  let out = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** Generates a code like "GC-7F3K-9QRT-2MXP". Uniqueness is enforced by
 * the DB's @unique constraint, not checked here — callers should retry
 * generation on the rare P2002 collision rather than pre-checking. */
export function generateGiftCardCode(): string {
  const segments = Array.from({ length: CODE_SEGMENTS }, () => randomSegment(CODE_SEGMENT_LENGTH));
  return `GC-${segments.join("-")}`;
}

export function normalizeGiftCardCode(code: string): string {
  return code.trim().toUpperCase();
}

export interface GiftCardInfo {
  id: string;
  code: string;
  balance: number;
}

/**
 * Looks up a gift card and checks everything that CAN be checked outside
 * a transaction — exists, active, has a positive balance. Used both for
 * the public "preview before checkout" endpoint AND as the first check
 * inside the order-creation transaction (see redeemGiftCard below); the
 * transaction re-checks the balance regardless, since this lookup alone
 * can't prevent a race between two simultaneous orders redeeming the
 * same card — see redeemGiftCard's own comment for what's re-verified
 * atomically.
 */
export async function findValidGiftCard(
  code: string
): Promise<{ ok: true; giftCard: GiftCardInfo } | { ok: false; error: string }> {
  const trimmed = code?.trim();
  if (!trimmed) return { ok: false, error: "Enter a gift card code" };

  const normalized = normalizeGiftCardCode(trimmed);
  const giftCard = await prisma.giftCard.findUnique({ where: { code: normalized } });

  if (!giftCard) return { ok: false, error: "Invalid gift card code" };
  if (!giftCard.isActive) return { ok: false, error: "This gift card is no longer active" };
  if (giftCard.balance <= 0) return { ok: false, error: "This gift card has no remaining balance" };

  return {
    ok: true,
    giftCard: { id: giftCard.id, code: giftCard.code, balance: giftCard.balance },
  };
}

/**
 * How much of a gift card's balance can actually be applied to a given
 * order total. A gift card can never take an order below $0 (unlike a
 * coupon, which is a bounded discount, a gift card's balance may exceed
 * the order total entirely — e.g. a $50 card against a $12 order — in
 * which case only $12 is applied and $38 remains on the card for a
 * future order). `orderTotalAfterOtherDiscounts` should already reflect
 * any coupon discount applied first, so the two never double up on the
 * same dollar of the cart.
 */
export function calcGiftCardAmountToApply(
  orderTotalAfterOtherDiscounts: number,
  giftCardBalance: number
): number {
  const amount = Math.min(Math.max(orderTotalAfterOtherDiscounts, 0), giftCardBalance);
  return Math.round(amount * 100) / 100;
}

/**
 * Atomically debits `amount` from a gift card and records the redemption
 * inside an existing transaction. Must run in the SAME transaction as
 * the Order row it's being attached to — if order creation later fails
 * and the transaction rolls back, the debit (and the GiftCardTransaction
 * row) rolls back with it, so the balance isn't spent on a failed order.
 *
 * Concurrency guarantee: the `updateMany` below is the actual guard —
 * its WHERE clause re-checks `balance >= amount` at the DB level and its
 * affected-row count tells us whether THIS call actually won against a
 * concurrent redemption of the same card. findValidGiftCard above is
 * only an optimistic pre-check for a fast error message, never
 * sufficient alone to prevent two simultaneous orders from both trying
 * to spend the same last few dollars on a card.
 */
export async function redeemGiftCard(
  tx: Prisma.TransactionClient,
  giftCardId: string,
  orderId: string,
  amount: number
): Promise<boolean> {
  if (amount <= 0) return false;

  const claim = await tx.giftCard.updateMany({
    where: {
      id: giftCardId,
      isActive: true,
      balance: { gte: amount },
    },
    data: { balance: { decrement: amount } },
  });
  if (claim.count !== 1) return false;

  await tx.giftCardTransaction.create({
    data: {
      giftCardId,
      orderId,
      amount: -amount,
      type: "REDEEM",
    },
  });

  return true;
}

/**
 * Credits a newly purchased or manually-issued gift card, creating both
 * the GiftCard row and its opening PURCHASE/ISSUE transaction in one
 * call. Not itself required to run inside a caller-supplied transaction
 * (Prisma's interactive-transaction wrapper here is self-contained) —
 * used both by the Stripe webhook (after payment confirmed) and the
 * admin manual-issue endpoint (credited immediately, no payment
 * involved).
 */
export async function createGiftCard(params: {
  amount: number;
  type: "PURCHASE" | "ISSUE";
  stripeSessionId?: string | null;
  purchaserEmail?: string | null;
  purchaserName?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  message?: string | null;
  note?: string | null;
}) {
  // Retry on the rare code collision (@unique) rather than pre-checking
  // existence — collisions are astronomically unlikely given the
  // alphabet/length above, but a retry loop is cheap insurance.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateGiftCardCode();
    try {
      return await prisma.$transaction(async (tx) => {
        const giftCard = await tx.giftCard.create({
          data: {
            code,
            initialAmount: params.amount,
            balance: params.amount,
            stripeSessionId: params.stripeSessionId ?? null,
            purchaserEmail: params.purchaserEmail ?? null,
            purchaserName: params.purchaserName ?? null,
            recipientEmail: params.recipientEmail ?? null,
            recipientName: params.recipientName ?? null,
            message: params.message ?? null,
          },
        });

        await tx.giftCardTransaction.create({
          data: {
            giftCardId: giftCard.id,
            amount: params.amount,
            type: params.type,
            note: params.note ?? null,
          },
        });

        return giftCard;
      });
    } catch (error) {
      const isUniqueCodeCollision =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";
      if (isUniqueCodeCollision && attempt < 4) continue;
      throw error;
    }
  }
  throw new Error("Failed to generate a unique gift card code");
}
