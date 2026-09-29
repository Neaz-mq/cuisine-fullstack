import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUp, Calendar } from "lucide-react";

/**
 * Building blocks of the rider panel pages — Figma "Rider Dashboard":
 *
 *   stat card    white, radius 16, padding 16, gap 20: Frank Ruhl 20/500
 *                title + 40px cream circle icon, 24/600 value, green
 *                "+4% week" pill, Sora 12 hint (black 70%)
 *   quick card   the same card without the value (110px)
 *   big card     white, radius 30, padding 30 — "Recent Deliveries"
 *   list row     cream #F9F6F3, radius 16, padding 16
 *   status chip  Sora 14, padding 11/12, fully round — green "Delivered"
 *
 * Server components (no state), shared by every page under
 * /admin/my-deliveries so they look like one app.
 */

export const GRADIENT_TEXT = "bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent";
export const GRADIENT_BG = "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)]";

/** "Welcome Back, Ridoy Ahmed!" or a page title, with the date and actions. */
export function RiderPageHeader({
  title,
  name,
  subtitle,
  actions,
  now,
}: {
  /** Plain page title; leave out for the "Welcome Back" greeting. */
  title?: string;
  name?: string;
  subtitle?: string;
  actions?: ReactNode;
  now: Date;
}) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
      <div className="min-w-0">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          {title ?? (
            <>
              Welcome Back, <span className={GRADIENT_TEXT}>{name || "there"}!</span>
            </>
          )}
        </h1>
        {subtitle && (
          <p className="mt-2 font-sora text-[13px] leading-[1.5] text-black/60 md:text-[14px]">{subtitle}</p>
        )}
      </div>

      <div className="flex w-full shrink-0 flex-wrap items-center gap-2.5 md:w-auto md:flex-nowrap">
        <span className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black min-[480px]:h-[50px] min-[480px]:px-4 min-[480px]:text-[16px]">
          <Calendar className="h-4 w-4 shrink-0 min-[480px]:h-5 min-[480px]:w-5" strokeWidth={1.5} aria-hidden="true" />
          {now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        {actions}
      </div>
    </div>
  );
}

export function IconCircle({ children, tone = "cream" }: { children: ReactNode; tone?: "cream" | "white" }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-black ${
        tone === "cream" ? "bg-[#F9F6F3]" : "bg-white"
      }`}
    >
      {children}
    </span>
  );
}

export function RiderStatCard({
  label,
  value,
  hint,
  icon,
  delta,
  deltaLabel = "week",
  tone = "white",
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  /** "+4% week" pill — null/undefined hides it. */
  delta?: number | null;
  deltaLabel?: string;
  /** "cream" when the card sits inside a white section. */
  tone?: "white" | "cream";
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div
      className={`flex min-h-[142px] min-w-0 flex-col gap-5 rounded-[16px] p-4 ${tone === "white" ? "bg-white" : "bg-[#F9F6F3]"}`}
    >
      {/* 18px, not Figma's 20: in the real font "Avg. Delivery Time" at 20px
          is wider than Figma's text box and got cut to "Avg. Delivery Ti…". */}
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-frank-ruhl text-[18px] font-medium leading-none text-black">
          {label}
        </span>
        <IconCircle tone={tone === "white" ? "cream" : "white"}>{icon}</IconCircle>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="font-frank-ruhl text-[22px] font-semibold leading-none text-black xl:text-[24px]">{value}</span>
          {delta !== null && delta !== undefined && (
            <span
              className={`flex items-center gap-1 rounded-full px-1.5 py-1 font-sora text-[12px] leading-none xl:text-[14px] ${
                up ? "bg-[#F1FEF3] text-[#0ECF00]" : "bg-[#FFE9EC] text-[#FF3F5C]"
              }`}
              title={`Compared with the same day last ${deltaLabel}`}
            >
              <ArrowUp className={`h-3 w-3 ${up ? "" : "rotate-180"}`} strokeWidth={2.5} aria-hidden="true" />
              {up ? "+" : ""}
              {delta}% {deltaLabel}
            </span>
          )}
        </div>
        <span className="font-sora text-[12px] leading-none text-black/70">{hint}</span>
      </div>
    </div>
  );
}

/** Figma quick link card (Available Orders / Delivery History / …). */
export function RiderQuickCard({ href, label, hint, icon }: { href: string; label: string; hint: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-[110px] min-w-0 flex-col gap-5 rounded-[16px] bg-white p-4 transition-shadow hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-frank-ruhl text-[18px] font-medium leading-none text-black xl:text-[20px]">
          {label}
        </span>
        <IconCircle>{icon}</IconCircle>
      </span>
      <span className="font-sora text-[12px] leading-[1.5] text-black/70">{hint}</span>
    </Link>
  );
}

/** White section — Figma "Recent Deliveries" (radius 30, padding 30). */
export function RiderSection({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:rounded-[30px] md:p-[30px] ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const CHIP: Record<string, string> = {
  DELIVERED: "bg-[#F1FEF3] text-[#0ECF00]",
  CANCELLED: "bg-[#FFE9EC] text-[#FF3F5C]",
  OUT_FOR_DELIVERY: "bg-[#FFEDE0] text-[#FF7100]",
  PREPARING: "bg-[#FFF2DA] text-[#C77C00]",
  PLACED: "bg-[#E5EDFF] text-[#0090FF]",
  COD: "bg-[#FFF2DA] text-[#C77C00]",
  ONLINE: "bg-[#E5EDFF] text-[#0090FF]",
};

const CHIP_LABEL: Record<string, string> = {
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  OUT_FOR_DELIVERY: "On the way",
  PREPARING: "Waiting for pickup",
  PLACED: "Waiting for pickup",
  COD: "Cash",
  ONLINE: "Paid online",
};

export function StatusChip({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={`inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 font-sora text-[12px] leading-none min-[480px]:text-[14px] ${
        CHIP[status] ?? "bg-[#F9F6F3] text-black"
      }`}
    >
      {label ?? CHIP_LABEL[status] ?? status}
    </span>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[16px] bg-[#F9F6F3] p-4 font-sora text-[14px] leading-[1.7] text-black/70">{children}</p>
  );
}

/** A Figma list row: bold id + small grey line on the left, money + chip on the right. */
export function RiderListRow({
  title,
  subtitle,
  extra,
  amount,
  chip,
  href,
}: {
  title: string;
  subtitle: string;
  extra?: ReactNode;
  amount?: string;
  chip?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-frank-ruhl text-[18px] font-medium leading-[1.2] text-black md:text-[20px]">{title}</span>
        <span className="truncate font-sora text-[12px] leading-[1.7] text-black/70">{subtitle}</span>
        {extra}
      </span>
      <span className="flex shrink-0 items-center gap-3 min-[480px]:gap-6">
        {amount && (
          <span className="whitespace-nowrap font-frank-ruhl text-[16px] font-medium leading-none text-black">{amount}</span>
        )}
        {chip}
      </span>
    </>
  );
  const className =
    "flex flex-col gap-3 rounded-[16px] bg-[#F9F6F3] p-4 min-[560px]:min-h-20 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between";
  return href ? (
    <Link
      href={href}
      className={`${className} transition-colors hover:bg-black/[0.04] focus:outline-none focus-visible:[outline:2px_solid_#FF9540]`}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Five small stars, filled up to `value`. */
export function Stars({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={star <= value ? "#FF9540" : "none"} stroke="#FF9540" strokeWidth={1.8} aria-hidden="true">
          <path d="M12 2.5l2.9 5.88 6.49.95-4.7 4.58 1.11 6.46L12 17.33l-5.8 3.05 1.1-6.46-4.69-4.58 6.49-.95L12 2.5Z" />
        </svg>
      ))}
    </span>
  );
}
