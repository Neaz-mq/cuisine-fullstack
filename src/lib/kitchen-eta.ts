// ---------------------------------------------------------------------------
// Live Kitchen Queue / Smart ETA
//
// Replaces the old hardcoded "Delivery time: 20m/35m" labels on the
// checkout page (Carts.tsx) with a number derived from how busy the
// kitchen actually is right now.
//
// v1 design (queue-length based — see project notes for why):
//   kitchenPrepMinutes = BASE_PREP_MINUTES + queueLength * PER_ORDER_MINUTES
//   (clamped to [BASE_PREP_MINUTES, MAX_PREP_MINUTES])
//
// `queueLength` = number of orders currently in PLACED or PREPARING status —
// the exact same set the Kitchen Display System shows (see
// /api/admin/kitchen/orders and admin/kitchen/page.tsx).
//
// IMPORTANT: this file must stay free of any server-only imports (Prisma,
// etc.) — it's imported directly by the client component Carts.tsx, and
// pulling Prisma into a client bundle breaks the build ("chunking context
// does not support external modules"). The actual DB query
// (KITCHEN_QUEUE_STATUSES is exported so it stays in sync) lives in
// src/app/api/kitchen/eta/route.ts, which runs server-side only. That
// query is also duplicated in the KDS page/route — if you change the
// status filter here, change it in all three places.
//
// Not modeled yet (documented so this isn't mistaken for an oversight):
//   - Per-menu-item prep time (MenuItem has no prepTimeMinutes field) —
//     every order is treated as equally complex.
//   - Historical actual-completion-time data — Order has no
//     preparingStartedAt/readyAt timestamps, only createdAt/updatedAt,
//     so there's no reliable "how long did prep actually take" signal
//     to learn from yet.
// Both are natural v2 upgrades if the flat per-order estimate proves too
// coarse in practice.
// ---------------------------------------------------------------------------

export const KITCHEN_QUEUE_STATUSES = ["PLACED", "PREPARING"] as const;

const BASE_PREP_MINUTES = 15; // prep time for a single order with an empty queue
const PER_ORDER_QUEUE_MINUTES = 4; // added per order already ahead in the queue
const MAX_PREP_MINUTES = 45; // cap so a slammed kitchen doesn't show an absurd number

// Third-party courier transit time, independent of our kitchen — these were
// already the numbers baked into the old static labels ("20m/35m",
// "1h/1.35h"), just now added on TOP of a real prep estimate instead of
// being the whole story.
export const SHIPPING_TRANSIT_MINUTES: Record<"UBER_EATS" | "FOOD_PANDA", { min: number; max: number }> = {
  UBER_EATS: { min: 20, max: 35 },
  FOOD_PANDA: { min: 60, max: 81 },
};

export function calcKitchenPrepMinutes(queueLength: number): number {
  const raw = BASE_PREP_MINUTES + queueLength * PER_ORDER_QUEUE_MINUTES;
  return Math.min(raw, MAX_PREP_MINUTES);
}

export type ShippingEtaRange = { min: number; max: number };

export function calcShippingEta(
  kitchenPrepMinutes: number,
  method: "UBER_EATS" | "FOOD_PANDA"
): ShippingEtaRange {
  const transit = SHIPPING_TRANSIT_MINUTES[method];
  return {
    min: kitchenPrepMinutes + transit.min,
    max: kitchenPrepMinutes + transit.max,
  };
}

// "35m" / "1h 20m" style formatting for display next to each shipping option.
export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}