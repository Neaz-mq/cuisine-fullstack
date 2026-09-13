import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/reservation-filters.ts
 *
 * /admin/reservations পাতার ছাঁকনি — অবস্থা আর সময়সীমা।
 *
 * ⚠️ Payment পাতার ছাঁকনির থেকে আলাদা ফাইল, যদিও গড়নটা এক। একটা
 * বুকিংয়ের অবস্থা (PENDING → SEATED → COMPLETED) আর একটা চালানের
 * অবস্থা (PENDING → PAID) সম্পূর্ণ আলাদা জিনিস; এক তালিকায় রাখলে
 * একদিন কেউ ভুল পাতায় ভুল অবস্থা যোগ করে বসতেন।
 */
export const RESERVATION_STATUSES = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "SEATED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type ReservationStatusFilter = (typeof RESERVATION_STATUSES)[number];

export const DEFAULT_RESERVATION_STATUS: ReservationStatusFilter = "ALL";

export function isReservationStatus(value: unknown): value is ReservationStatusFilter {
  return typeof value === "string" && (RESERVATION_STATUSES as readonly string[]).includes(value);
}

export const RESERVATION_STATUS_OPTIONS: FilterMenuOption<ReservationStatusFilter>[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "SEATED", label: "Seated" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_SHOW", label: "No Show", triggerLabel: "No Show" },
];

/**
 * Figma-র প্রতিটা অবস্থার নিজস্ব জোড়া রং।
 *
 * ⚠️ রংগুলো Payment পাতার ব্যাজের সাথে মিলিয়ে রাখা হয়েছে (নীল = সদ্য
 * এসেছে, সবুজ = সম্পন্ন, লাল = বাতিল)। দুটো পাতায় একই অর্থে একই রং
 * থাকলে staff-কে দুটো আলাদা রঙের ভাষা শিখতে হয় না।
 */
export const RESERVATION_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Placed", className: "bg-[#E6EDFE] text-[#3A8DFA]" },
  CONFIRMED: { label: "Confirmed", className: "bg-[#E8FFEC] text-[#0ECF00]" },
  SEATED: { label: "Seated", className: "bg-[#FDF3DC] text-[#F3A42F]" },
  COMPLETED: { label: "Completed", className: "bg-[#E9E0FD] text-[#530EF8]" },
  CANCELLED: { label: "Cancelled", className: "bg-[#FFECEC] text-[#D72A37]" },
  NO_SHOW: { label: "No Show", className: "bg-black/5 text-black/60" },
};
