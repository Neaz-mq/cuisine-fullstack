import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * src/lib/reservations.ts
 *
 * একই table double-book হওয়া ঠেকানোর জন্য সব overlap-check logic এখানে
 * এক জায়গায় রাখা হয়েছে, যাতে /api/tables (availability দেখানো) আর
 * /api/reservations (বুকিং তৈরি করা) — দুই জায়গায় আলাদা আলাদা করে একই
 * নিয়ম লিখতে না হয় এবং দুটো কখনো out-of-sync না হয়ে যায়।
 *
 * একটা reservation একটা table কে এই সময়ের জন্য "দখল" করে রাখে:
 *   [reservedAt, reservedAt + RESERVATION_DURATION_MINUTES)
 * নতুন বুকিং এই window-এর সাথে overlap করলে সেটা conflict ধরা হয়।
 */

export const RESERVATION_DURATION_MINUTES = 90;

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "SEATED"] as const;

type DbClient = typeof prisma | Prisma.TransactionClient;

/**
 * একটা table-এ দেওয়া সময়ে বসার জন্য জায়গা খালি আছে কিনা চেক করে।
 * (CANCELLED/NO_SHOW/COMPLETED reservation গুলো block করে না।)
 *
 * `db` প্যারামিটার দিয়ে চাইলে একটা $transaction-এর ভেতরের client
 * (tx) পাস করা যায়, যাতে check + create সত্যিকারের atomic হয় এবং
 * দুইটা একই সাথে আসা request race condition তৈরি না করে।
 */
export async function isTableAvailable(
  tableId: string,
  reservedAt: Date,
  opts?: { excludeReservationId?: string; db?: DbClient }
): Promise<boolean> {
  const db = opts?.db ?? prisma;
  const durationMs = RESERVATION_DURATION_MINUTES * 60 * 1000;
  const requestedStart = reservedAt.getTime();
  const requestedEnd = requestedStart + durationMs;

  // সম্ভাব্য conflict range-এর reservation গুলো টেনে এনে JS-এ overlap চেক করা —
  // এতে raw SQL ছাড়াই DB-agnostic ভাবে ঠিকঠাক কাজ করে।
  const windowStart = new Date(requestedStart - durationMs);
  const windowEnd = new Date(requestedEnd + durationMs);

  const nearby = await db.reservation.findMany({
    where: {
      tableId,
      status: { in: [...ACTIVE_STATUSES] },
      reservedAt: { gte: windowStart, lte: windowEnd },
      ...(opts?.excludeReservationId
        ? { id: { not: opts.excludeReservationId } }
        : {}),
    },
    select: { reservedAt: true },
  });

  return !nearby.some((r) => {
    const existingStart = r.reservedAt.getTime();
    const existingEnd = existingStart + durationMs;
    return existingStart < requestedEnd && requestedStart < existingEnd;
  });
}