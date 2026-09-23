"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-toastify";
import { Loader2, Mail, Send, Users } from "lucide-react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import {
  FIELD,
  LABEL,
  ModalError,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  SelectField,
  TEXTAREA,
} from "@/components/admin/modal-ui";

/**
 * The composer on /admin/marketing, and a live preview of the email.
 *
 * Same fields and buttons as the admin modals (cream fields, gradient
 * primary, outline secondary), so it reads as part of the same system.
 *
 * "Feature an Offer" lists the product offers running right now. Picking
 * one fills in a subject, headline and message (only while you haven't
 * typed your own) and puts the dish in the email as a card. The server
 * reads the dish and prices itself when sending — the preview here is
 * just a preview.
 *
 * "Send Test to Me" sends the same email to your own inbox only. "Send to
 * Subscribers" asks once more, then sends to every opted-in customer.
 */
/** Who a broadcast will reach — see page.tsx. */
export type SubscriberInfo = {
  count: number;
  unsubscribed: number;
  /** More contacts than were counted — shown as "5,000+". */
  capped: boolean;
  /** false = Resend couldn't be reached; the number is a database estimate. */
  fromResend: boolean;
};

export type OfferOption = {
  id: string;
  title: string;
  imageUrl: string | null;
  badge: string;
  oldPrice: string;
  newPrice: string;
  note: string;
  membersOnly: boolean;
};

const CARD = "flex min-w-0 flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]";
const CARD_TITLE =
  "min-w-0 font-frank-ruhl text-[22px] font-semibold leading-tight text-black min-[480px]:text-[24px] min-[480px]:leading-none xl:text-[30px]";
const SECTION_TITLE = "font-frank-ruhl text-[18px] font-medium leading-[1.6] text-black";
const HELP = "mt-1.5 font-sora text-[12px] leading-[1.5] text-black/60";

const GRADIENT = "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)]";

const LIMITS = { subject: 150, headline: 120, message: 5000, ctaText: 40 };

function Counter({ value, max }: { value: string; max: number }) {
  const near = value.length > max * 0.9;
  return (
    <span className={`font-sora text-[11px] ${near ? "text-[#D72A37]" : "text-black/50"}`}>
      {value.length}/{max}
    </span>
  );
}

export default function MarketingForm({
  offers,
  subscribers,
  staffEmail,
}: {
  offers: OfferOption[];
  subscribers: SubscriberInfo;
  staffEmail: string | null;
}) {
  const subscriberCount = subscribers.count;
  const countLabel = `${subscriberCount.toLocaleString("en-US")}${subscribers.capped ? "+" : ""}`;
  const [offerId, setOfferId] = useState("");
  const [subject, setSubject] = useState("");
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [ctaText, setCtaText] = useState("Order Now");
  const [ctaUrl, setCtaUrl] = useState("");
  // Once staff type their own words, picking an offer no longer replaces
  // them on its own — the notice under the picker offers to instead.
  const [typedOwn, setTypedOwn] = useState(false);
  // The offer whose text is in the fields — to spot when the text talks
  // about one dish while the card shows another.
  const [textOfferId, setTextOfferId] = useState("");

  const [sending, setSending] = useState<"test" | "all" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const featured = offers.find((offer) => offer.id === offerId) ?? null;

  const fillFromOffer = (offer: OfferOption) => {
    setTextOfferId(offer.id);
    setTypedOwn(false);
    setSubject(`${offer.badge} ${offer.title} — for a limited time`);
    setHeadline(`${offer.badge} ${offer.title}`);
    setMessage(
      `Treat yourself: ${offer.title} is now ${offer.newPrice} instead of ${offer.oldPrice}.\n` +
        (offer.membersOnly
          ? "This one is just for members — sign in to your Cuisine account when you order.\n"
          : "") +
        "Order online in a few taps, or drop by and enjoy it fresh."
    );
    setCtaText("Order Now");
  };

  const pickOffer = (id: string) => {
    setOfferId(id);
    setError(null);
    const offer = offers.find((o) => o.id === id);
    if (offer && !typedOwn) fillFromOffer(offer);
  };

  // The text was written for a different dish than the card now shows.
  const textOffer = offers.find((o) => o.id === textOfferId) ?? null;
  const mismatch = featured !== null && textOffer !== null && textOffer.id !== featured.id;

  const own = <T,>(setter: (value: T) => void) => (value: T) => {
    setTypedOwn(true);
    setter(value);
  };

  const problem = (() => {
    if (!subject.trim()) return "Write a subject line.";
    if (!message.trim()) return "Write a message.";
    if (ctaUrl.trim() && !/^https?:\/\/\S+\.\S+/.test(ctaUrl.trim())) {
      return "Button link must be a full address, like https://yoursite.com/menu";
    }
    return null;
  })();

  const send = async (test: boolean) => {
    if (problem) {
      setError(problem);
      return;
    }
    setSending(test ? "test" : "all");
    setError(null);
    try {
      const res = await fetch("/api/admin/marketing/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, headline, message, ctaText, ctaUrl, offerId, test }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Send failed (error ${res.status}).`);

      if (test) {
        toast.success(`Test email sent to ${data.sentTo ?? "your inbox"}`);
      } else {
        toast.success("Email sent to your subscribers");
        setConfirming(false);
        setOfferId("");
        setSubject("");
        setHeadline("");
        setMessage("");
        setCtaText("Order Now");
        setCtaUrl("");
        setTypedOwn(false);
        setTextOfferId("");
      }
    } catch (err) {
      setConfirming(false);
      setError(err instanceof Error ? err.message : "Network error — please try again.");
    } finally {
      setSending(null);
    }
  };

  const offerOptions = [
    { value: "", label: offers.length ? "No offer — just a message" : "No offers running" },
    ...offers.map((offer) => ({
      value: offer.id,
      label: `${offer.title} — ${offer.badge} (${offer.newPrice})`,
    })),
  ];

  const paragraphs = message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      {/* ── Composer ── */}
      <section className={CARD}>
        <div className="flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
          <h2 className={CARD_TITLE}>Email Subscribers</h2>
          <span className="flex h-10 w-fit shrink-0 items-center gap-2 rounded-full bg-[#F9F6F3] px-4 font-sora text-[14px] leading-none text-black">
            <Users className="h-4 w-4 text-black/70" strokeWidth={1.5} aria-hidden="true" />
            {subscribers.fromResend ? "" : "~"}
            {countLabel} {subscriberCount === 1 ? "subscriber" : "subscribers"}
          </span>
        </div>
        <p className="-mt-2 font-sora text-[14px] leading-[1.6] text-black/70">
          Goes only to customers who opted in to offer emails. Anyone who unsubscribed is left out
          automatically.
          {subscribers.fromResend && subscribers.unsubscribed > 0 && (
            <>
              {" "}
              {subscribers.unsubscribed.toLocaleString("en-US")}{" "}
              {subscribers.unsubscribed === 1 ? "person has" : "people have"} unsubscribed.
            </>
          )}
          {!subscribers.fromResend && (
            <span className="text-[#D72A37]">
              {" "}
              Couldn&apos;t reach Resend, so this number is an estimate from signed-in customers.
            </span>
          )}
        </p>

        {/* Feature an offer */}
        <div className="flex flex-col gap-4">
          <h3 className={SECTION_TITLE}>Feature an Offer</h3>
          <SelectField
            id="broadcast-offer"
            label="Running offer (optional)"
            value={offerId}
            onChange={pickOffer}
            options={offerOptions}
          />
          {mismatch && (
            <div className="flex flex-col gap-3 rounded-[12px] bg-[#FFF2DA] p-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
              <p className="font-sora text-[12px] leading-[1.5] text-black">
                Your text still talks about <span className="font-semibold">{textOffer!.title}</span>, but the
                card now shows <span className="font-semibold">{featured!.title}</span>. It was kept because
                you edited it.
              </p>
              <button
                type="button"
                onClick={() => fillFromOffer(featured!)}
                className="h-9 shrink-0 whitespace-nowrap rounded-full bg-black px-4 font-sora text-[12px] font-semibold leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
              >
                Use {featured!.title} text
              </button>
            </div>
          )}
          {offers.length === 0 ? (
            <p className={HELP}>
              No product offers are running.{" "}
              <Link href="/admin/offers" className="text-black underline underline-offset-2">
                Create one on the Offers page
              </Link>{" "}
              to show a dish with its new price in the email.
            </p>
          ) : (
            <p className={HELP}>
              The dish is shown as a card with its old and new price, and the button links to it.
            </p>
          )}
        </div>

        {/* Email content */}
        <div className="flex flex-col gap-4">
          <h3 className={SECTION_TITLE}>Email Content</h3>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="broadcast-subject" className={LABEL}>
                Subject Line
              </label>
              <Counter value={subject} max={LIMITS.subject} />
            </div>
            <input
              id="broadcast-subject"
              value={subject}
              maxLength={LIMITS.subject}
              onChange={(event) => own(setSubject)(event.target.value)}
              placeholder="Weekend Special: 20% off all pizzas!"
              className={`${FIELD} max-[639px]:text-[16px]`}
            />
            <p className={HELP}>What people see in their inbox.</p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="broadcast-headline" className={LABEL}>
                Headline <span className="font-sora text-[12px] font-normal text-black/50">(optional)</span>
              </label>
              <Counter value={headline} max={LIMITS.headline} />
            </div>
            <input
              id="broadcast-headline"
              value={headline}
              maxLength={LIMITS.headline}
              onChange={(event) => own(setHeadline)(event.target.value)}
              placeholder="Uses the subject line if left blank"
              className={`${FIELD} max-[639px]:text-[16px]`}
            />
            <p className={HELP}>The big text at the top of the email.</p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="broadcast-message" className={LABEL}>
                Message
              </label>
              <Counter value={message} max={LIMITS.message} />
            </div>
            <textarea
              id="broadcast-message"
              value={message}
              maxLength={LIMITS.message}
              rows={7}
              onChange={(event) => own(setMessage)(event.target.value)}
              placeholder={
                "This weekend only — enjoy 20% off every pizza on our menu.\nOrder online now, or come by and show this email."
              }
              className={`${TEXTAREA} max-[639px]:text-[16px]`}
            />
            <p className={HELP}>Type normally — each new line becomes its own paragraph.</p>
          </div>

          <div className="grid gap-4 min-[560px]:grid-cols-2">
            <div>
              <label htmlFor="broadcast-cta" className={LABEL}>
                Button Text
              </label>
              <input
                id="broadcast-cta"
                value={ctaText}
                maxLength={LIMITS.ctaText}
                onChange={(event) => setCtaText(event.target.value)}
                placeholder="Order Now"
                className={`${FIELD} max-[639px]:text-[16px]`}
              />
            </div>
            <div>
              <label htmlFor="broadcast-link" className={LABEL}>
                Button Link <span className="font-sora text-[12px] font-normal text-black/50">(optional)</span>
              </label>
              <input
                id="broadcast-link"
                type="url"
                value={ctaUrl}
                onChange={(event) => setCtaUrl(event.target.value)}
                placeholder={featured ? "The dish's page" : "Your site's homepage"}
                className={`${FIELD} max-[639px]:text-[16px]`}
              />
            </div>
          </div>
        </div>

        {error && <ModalError message={error} />}

        {/* Actions */}
        <div className="flex flex-col gap-2 min-[560px]:flex-row min-[560px]:justify-end">
          <button
            type="button"
            onClick={() => send(true)}
            disabled={sending !== null}
            title={staffEmail ? `Sends only to ${staffEmail}` : undefined}
            className={`${OUTLINE_BUTTON} min-[560px]:min-w-[190px]`}
          >
            {sending === "test" ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Mail className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            )}
            {sending === "test" ? "Sending…" : "Send Test to Me"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (problem) setError(problem);
              else if (subscribers.fromResend && subscriberCount === 0)
                setError("No one is subscribed yet, so there's no one to send to. Use Send Test to Me to check the email.");
              else setConfirming(true);
            }}
            disabled={sending !== null}
            className={`${PRIMARY_BUTTON} min-[560px]:min-w-[220px]`}
          >
            <Send className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Send to Subscribers
          </button>
        </div>
      </section>

      {/* ── Live preview ── */}
      <section className={`${CARD} xl:sticky xl:top-[30px]`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-frank-ruhl text-[22px] font-semibold leading-none text-black">Preview</h2>
          <span className="rounded-full bg-[#F9F6F3] px-3 py-2 font-sora text-[12px] leading-none text-black/70">
            Live
          </span>
        </div>

        {/* How it looks in the inbox */}
        <div className="flex items-center gap-3 rounded-[16px] bg-[#F9F6F3] p-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${GRADIENT} font-frank-ruhl text-[18px] font-semibold text-white`}
            aria-hidden="true"
          >
            C
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-sora text-[12px] font-semibold leading-none text-black">Cuisine</span>
            <span className="truncate font-sora text-[13px] leading-tight text-black">
              {subject || "Your subject line"}
            </span>
            <span className="truncate font-sora text-[11px] leading-tight text-black/50">
              {paragraphs[0] ?? "The first line of your message shows here."}
            </span>
          </div>
        </div>

        {/* The email itself — same order and colours as OfferBroadcastEmail */}
        <div className="rounded-[16px] bg-[#F9F6F3] p-3 min-[480px]:p-4">
          <div className="overflow-hidden rounded-[16px] bg-white">
            <div className={`${GRADIENT} flex flex-col items-center gap-3 px-5 py-6 text-center`}>
              {/* Wordmark only — the orange logo mark disappeared into the
                  orange gradient behind it. */}
              <span className="font-frank-ruhl text-[22px] font-bold leading-none text-white">Cuisine</span>
              <span className="rounded-full bg-white px-3 py-1.5 font-sora text-[10px] font-semibold uppercase tracking-[0.06em] text-black">
                {featured ? `${featured.badge} · Special Offer` : "Special Offer"}
              </span>
              <p className="break-words font-frank-ruhl text-[22px] font-semibold leading-[1.2] text-white">
                {headline || subject || "Your headline"}
              </p>
            </div>

            <div className="flex flex-col gap-3 px-5 pb-2 pt-5">
              {paragraphs.length > 0 ? (
                paragraphs.map((line, index) => (
                  <p key={index} className="break-words font-sora text-[13px] leading-[1.7] text-black/70">
                    {line}
                  </p>
                ))
              ) : (
                <p className="font-sora text-[13px] leading-[1.7] text-black/40">Your message shows here.</p>
              )}
            </div>

            {featured && (
              <div className="px-5 pt-2">
                <div className="flex flex-col gap-2 rounded-[14px] bg-[#F9F6F3] p-2.5">
                  {featured.imageUrl && (
                    <div className="relative aspect-[295/200] w-full overflow-hidden rounded-[10px] bg-white">
                      <Image src={featured.imageUrl} alt="" fill sizes="360px" unoptimized className="object-cover" />
                    </div>
                  )}
                  <p className="px-1 font-frank-ruhl text-[17px] font-semibold leading-tight text-black">
                    {featured.title}
                  </p>
                  <p className="flex items-baseline gap-2 px-1">
                    <s className="font-sora text-[12px] text-black/45">{featured.oldPrice}</s>
                    <span className="font-frank-ruhl text-[19px] font-bold leading-none text-black">
                      {featured.newPrice}
                    </span>
                  </p>
                  <p className="px-1 pb-1 font-sora text-[11px] leading-[1.4] text-black/70">{featured.note}</p>
                </div>
              </div>
            )}

            <div className="flex justify-center px-5 pb-5 pt-6">
              <span
                className={`${GRADIENT} max-w-full truncate rounded-full px-7 py-3 font-sora text-[14px] font-semibold leading-none text-white`}
              >
                {ctaText.trim() || "Order Now"}
              </span>
            </div>

            <div className="mx-5 border-t border-[#EFE9E3] pb-5 pt-3">
              <p className="font-sora text-[10px] leading-[1.5] text-black/50">
                You&apos;re receiving this email because you opted in to offers and updates from Cuisine.
                Unsubscribe link added automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirming}
        tone="primary"
        title="Send to all subscribers?"
        message={`This goes to ${subscribers.fromResend ? "" : "about "}${countLabel} ${
          subscriberCount === 1 ? "subscriber" : "subscribers"
        }. Once sent it can't be taken back — send a test to yourself first if you haven't.${
          mismatch
            ? ` Heads up: your text is about ${textOffer!.title}, but the card shows ${featured!.title}.`
            : ""
        }`}
        confirmLabel="Send Now"
        pending={sending === "all"}
        onConfirm={() => send(false)}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
