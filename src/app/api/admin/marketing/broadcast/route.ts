// src/app/api/admin/marketing/broadcast/route.ts
import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { sendOfferBroadcast, sendOfferTestEmail } from "@/lib/resend";
import { plainTextToHtml } from "@/lib/plain-text-to-html";
import { broadcastSchema } from "@/lib/validations/admin";
import { parseBody } from "@/lib/validations/parse";
import { checkRateLimit } from "@/lib/rate-limit";
import { featuredOfferForEmail } from "@/lib/offer-admin";

/**
 * POST /api/admin/marketing/broadcast — "Email Subscribers" on the Offers
 * page (/admin/marketing).
 *
 *   { test: true }   "Send Test to Me" — only to the signed-in staff
 *                    member's own email.
 *   otherwise        the real send, to every contact in the Resend
 *                    marketing Audience (customers who opted in; Resend
 *                    leaves out anyone who unsubscribed).
 *
 * `offerId` (optional) puts a running product offer in the email as a card.
 * The dish, photo and prices are read here from the database, so the email
 * always shows the price the menu charges — and an offer that has ended
 * can't be emailed.
 */
export async function POST(request: Request) {
  const authResult = await requireApiScope("marketing");
  if (authResult instanceof NextResponse) return authResult;
  const session = authResult;

  const parsed = await parseBody(request, broadcastSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { subject, headline, message, ctaText, ctaUrl, offerId, test } = parsed;

  // A real send reaches every subscriber — a double click must not send the
  // same email twice, so it gets a tight limit. Tests are looser.
  const rate = checkRateLimit(request, test ? "marketing-test" : "marketing-broadcast", {
    limit: test ? 10 : 3,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: test
          ? "Too many test emails. Please wait a few minutes."
          : "An email was just sent. Please wait a few minutes before sending another.",
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

    let featured = null;
    let defaultLink = appUrl;
    if (offerId) {
      const found = await featuredOfferForEmail(offerId);
      if (!found) {
        return NextResponse.json(
          { error: "That offer isn't running any more. Pick another one, or send without it." },
          { status: 409 }
        );
      }
      featured = found.card;
      // With a dish featured, the button goes straight to its page.
      defaultLink = `${appUrl}/menu/${found.menuItemId}`;
    }

    const email = {
      subject,
      // Headline is the large hero text shown at the top of the email —
      // falls back to the subject line so this field stays optional.
      headline: headline?.trim() || subject,
      // Admins type plain text — converted to safe paragraph HTML here.
      bodyHtml: plainTextToHtml(message),
      ctaText: ctaText?.trim() || "Order Now",
      ctaUrl: ctaUrl?.trim() || defaultLink,
      featured,
    };

    if (test) {
      const to = session.user.email;
      if (!to) {
        return NextResponse.json(
          { error: "Your staff account has no email address to send the test to." },
          { status: 400 }
        );
      }
      await sendOfferTestEmail(to, email);
      return NextResponse.json({ success: true, sentTo: to });
    }

    const result = await sendOfferBroadcast(email);
    return NextResponse.json({ success: true, broadcastId: result.broadcastId });
  } catch (error) {
    console.error("POST /api/admin/marketing/broadcast error:", error);
    return NextResponse.json(
      { error: test ? "Couldn't send the test email. Check the Resend settings." : "Failed to send broadcast. Check server logs." },
      { status: 502 }
    );
  }
}
