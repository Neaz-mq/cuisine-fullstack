/**
 * src/components/account/ui.ts
 *
 * The customer panel's building blocks, from Figma "Web/My Account":
 *   page      — cream #F9F6F3, "My Account" (Frank Ruhl 600, 40px)
 *   cards     — WHITE, radius 30, padding 30, 60px apart
 *   card title — Frank Ruhl 600, 36px
 *   inside a card — cream boxes (#F9F6F3), radius 16–20
 *   text      — Sora; secondary text black/70
 *   main action — orange→pink gradient; second action — black outline pill
 *
 * Kept in one place so every account page looks like one product.
 */

export const GRADIENT = "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)]";

/** White card — Figma: radius 30, padding 30. */
export const CARD = "rounded-[24px] bg-white p-5 md:rounded-[30px] md:p-[30px]";

/** Cream box inside a white card (stat boxes, order rows, list items). */
export const INNER_CARD = "rounded-[16px] bg-[#F9F6F3] p-4";

/** Figma card title: Frank Ruhl Libre 600, 36px, line-height 114%. */
export const CARD_TITLE =
  "font-frank-ruhl text-[26px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[30px] xl:text-[36px]";

export const CARD_SUBTITLE = "mt-2 font-sora text-[13px] leading-[1.6] text-black/70 md:text-[14px]";

/** Figma "#Cu-749347" / stat values: Frank Ruhl 600. */
export const STRONG_24 = "font-frank-ruhl text-[20px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[24px]";

const BUTTON_BASE =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 font-sora text-[14px] font-semibold leading-none transition focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-60 md:h-12 md:text-[15px]";

export const PRIMARY_BUTTON = `${BUTTON_BASE} ${GRADIENT} text-white hover:opacity-90`;

export const OUTLINE_BUTTON = `${BUTTON_BASE} border border-black text-black hover:bg-black hover:text-white`;

export const SMALL_PRIMARY = `inline-flex h-9 items-center justify-center gap-1.5 rounded-full ${GRADIENT} px-4 font-sora text-[12px] font-semibold leading-none text-white transition hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-60`;

export const SMALL_OUTLINE =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-black px-4 font-sora text-[12px] font-semibold leading-none text-black transition hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-60";

export const FIELD_LABEL = "mb-2 block font-sora text-[13px] font-medium leading-none text-black";

/** Cream input on a white card. */
export const FIELD_INPUT =
  "h-[50px] w-full rounded-[12px] bg-[#F9F6F3] px-4 font-sora text-[14px] leading-none text-black placeholder:text-black/35 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] disabled:cursor-not-allowed disabled:text-black/50";

export const FIELD_ERROR = "mt-1.5 font-sora text-[12px] text-[#D72A37]";

/**
 * Figma status pills: Delivered = #E8FFEC / #0ECF00, Out for Delivery =
 * #EBE0FF / #5A00FF. The rest follow the admin panel's colours.
 */
export const STATUS_PILL: Record<string, string> = {
  PLACED: "bg-[#FFF1E5] text-[#FF7100]",
  PREPARING: "bg-[#FFF8E1] text-[#B98900]",
  OUT_FOR_DELIVERY: "bg-[#EBE0FF] text-[#5A00FF]",
  DELIVERED: "bg-[#E8FFEC] text-[#0ECF00]",
  CANCELLED: "bg-[#FAE7EC] text-[#D72A37]",
};

export { ORDER_STATUS_BADGE } from "@/lib/order-status-filter";
