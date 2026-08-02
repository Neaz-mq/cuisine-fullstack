import { z } from "zod";

/**
 * src/lib/validations/chat.ts
 *
 * Validation for the rider <-> customer live chat feature (see
 * ChatMessage in prisma/schema.prisma for the full design note).
 */

/**
 * POST /api/orders/[id]/chat (customer side) and
 * POST /api/rider/deliveries/[orderId]/chat (rider side) share this same
 * body shape — only `message` is client-supplied; senderRole/senderName
 * are always derived server-side from the authenticated rider session or
 * the order's own firstName, never trusted from the request body.
 *
 * 1000 chars is generous for a delivery chat message (Uber Eats/Food
 * Panda's own chat inputs are far shorter) — the ceiling exists to stop
 * an oversized payload, not to constrain normal use.
 */
export const sendChatMessageSchema = z.object({
  message: z.string().trim().min(1, "Message can't be empty").max(1000, "Message is too long"),
});