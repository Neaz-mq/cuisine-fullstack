import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import { toMoney } from "@/lib/money";
import { applyOffer, lastOfferDay, liveOfferWhere } from "@/lib/product-offers";
import { getAudienceStats } from "@/lib/resend";
import MarketingForm, { type OfferOption } from "./marketing-form";

export const metadata = { title: "Email Subscribers" };

/**
 * /admin/marketing — "Email Subscribers" on the Offers page.
 *
 * Same header, cards and fields as the other admin pages. Left: the
 * composer. Right: a live preview of the email (the real email is
 * src/emails/OfferBroadcastEmail.tsx — same colours and order).
 *
 * The running product offers are passed in so staff can feature one; the
 * server reads the dish and prices again when sending.
 */
export default async function MarketingPage() {
  const session = await requireStaff("marketing");
  const settings = await getRestaurantSettings();
  const units = settings.currencyMinorUnits;
  const now = new Date();

  const money = (value: { toFixed(digits: number): string }) =>
    formatAmount(value.toFixed(units), settings.currency);

  const [audience, dbOptIns, liveOffers] = await Promise.all([
    // Who a broadcast will really reach: the Resend Audience, where
    // unsubscribes are recorded (see getAudienceStats).
    getAudienceStats(),
    // Fallback only, if Resend can't be reached: signed-in customers who
    // ticked "send me offers". It misses guests and can't see unsubscribes.
    prisma.user.count({ where: { role: "CUSTOMER", marketingConsent: true } }),
    prisma.productOffer.findMany({
      where: liveOfferWhere(now),
      orderBy: { startsAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        percentOff: true,
        fixedOff: true,
        audience: true,
        endsAt: true,
        menuItem: { select: { title: true, price: true, imageUrl: true } },
      },
    }),
  ]);

  const offers: OfferOption[] = liveOffers.flatMap((offer) => {
    const newPrice = applyOffer(offer.menuItem.price, offer, units);
    if (!newPrice) return [];
    const badge =
      offer.type === "PERCENT"
        ? `${offer.percentOff}% Off`
        : `${money(toMoney(offer.fixedOff))} Off`;
    const ends = offer.endsAt
      ? `Ends ${lastOfferDay(offer.endsAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: settings.timezone,
        })}`
      : "Limited time";
    return [
      {
        id: offer.id,
        title: offer.menuItem.title,
        imageUrl: offer.menuItem.imageUrl,
        badge,
        oldPrice: money(offer.menuItem.price),
        newPrice: money(newPrice),
        note: offer.audience === "MEMBERS" ? `${ends} · Members only — sign in to get it` : ends,
        membersOnly: offer.audience === "MEMBERS",
      },
    ];
  });

  return (
    <div className="flex flex-col gap-6">
      {/* ── Welcome header — same markup as the dashboard ── */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        <div className="flex w-full shrink-0 flex-nowrap items-center gap-2.5 md:w-auto">
          <span className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black md:h-11 md:flex-none md:px-4 md:text-[14px]">
            <Calendar className="h-4 w-4 shrink-0 text-black/70" strokeWidth={1.5} aria-hidden="true" />
            <span>
              {now.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: settings.timezone,
              })}
            </span>
          </span>
          <Link
            href="/admin/offers"
            className="flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-black px-4 font-sora text-[12px] font-semibold leading-none text-white transition-opacity hover:opacity-90 md:h-11 md:text-[14px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            Back to Offers
          </Link>
        </div>
      </div>

      <MarketingForm
        offers={offers}
        subscribers={
          audience
            ? {
                count: audience.subscribed,
                unsubscribed: audience.unsubscribed,
                capped: audience.capped,
                fromResend: true,
              }
            : { count: dbOptIns, unsubscribed: 0, capped: false, fromResend: false }
        }
        staffEmail={session.user.email ?? null}
      />
    </div>
  );
}
