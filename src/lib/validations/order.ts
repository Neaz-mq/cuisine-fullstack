import { z } from "zod";

/**
 * src/lib/validations/order.ts
 *
 * PATCH /api/orders/[id] previously did
 * `if (!VALID_STATUSES.includes(body.status))` against a plain string
 * array — works, but gives no type inference and silently accepts any
 * extra fields on the body. Same enum values as Prisma's OrderStatus
 * (prisma/schema.prisma), just re-declared here since generated Prisma
 * enums aren't zod schemas on their own.
 */
export const orderStatusUpdateSchema = z.object({
  status: z.enum(["PLACED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]),
});