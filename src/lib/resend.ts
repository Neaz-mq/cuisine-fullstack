import { Resend } from "resend";
import { render } from "@react-email/render";
import OfferBroadcastEmail, { type FeaturedOfferEmail } from "@/emails/OfferBroadcastEmail";

// Lazily instantiated so that importing this module never throws even if
// RESEND_API_KEY isn't set yet (e.g. local dev before the .env is filled
// in) — the error only surfaces when sendOrderConfirmationEmail() actually
// tries to send, and that failure is caught there so it never blocks order
// creation.
let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// Resend's sandbox sender — works immediately with no domain verification,
// good for development. Once a domain is verified in the Resend dashboard,
// set EMAIL_FROM in .env to something like "Cuisine <orders@yourdomain.com>"
// and this falls back to that instead.
export const EMAIL_FROM = process.env.EMAIL_FROM || "Cuisine <onboarding@resend.dev>";

// The "Marketing" sender should ideally be a different local-part than the
// transactional sender (e.g. offers@ vs orders@) — mixing marketing content
// into your transactional stream hurts deliverability for both. Falls back
// to EMAIL_FROM if a dedicated marketing sender isn't configured yet.
export const MARKETING_EMAIL_FROM = process.env.MARKETING_EMAIL_FROM || EMAIL_FROM;

/**
 * সব transactional email-এর dome mark। শুধু চিহ্নটাই — "Cuisine" শব্দটা
 * প্রতিটি template-এ HTML text হিসেবে আঁকা হয়, ছবির অংশ হিসেবে নয়। বহু
 * client ডিফল্টে ছবি block করে রাখে, তখন অন্তত নামটা টিকে থাকে।
 *
 * এক জায়গায় রাখা হয়েছে কারণ আগে প্রতিটি template নিজের `LOGO_URL`
 * constant রাখত, এবং একটি ভুল asset (একটি সবুজ পাতার ছবি) সবগুলোতেই
 * copy হয়ে গিয়েছিল — বহুদিন ধরে প্রতিটি order confirmation ওই ছবি নিয়ে
 * পাঠানো হয়েছে, কেউ ধরতে পারেনি। এখন ভুল করার মতো copy একটাই।
 *
 * PNG, SVG নয়: Gmail/Outlook/Yahoo কেউই email-এ SVG render করে না,
 * তাই public/logo.svg সরাসরি ব্যবহার করা যায় না।
 */
export const EMAIL_LOGO_URL =
  "https://res.cloudinary.com/dzi3u164c/image/upload/v1787480180/Logo_mfttxl.png";

// Created once in the Resend dashboard under Audience → Create Audience.
// Copy its ID into .env as RESEND_AUDIENCE_ID.
function getAudienceId(): string {
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!audienceId) {
    throw new Error("RESEND_AUDIENCE_ID is not set");
  }
  return audienceId;
}

/**
 * Adds (or updates) a customer as a contact in the Resend marketing
 * Audience. Call this after a customer opts in to marketing emails —
 * e.g. right after checkout.session.completed, gated on their consent
 * flag, or whenever they toggle the consent checkbox in their profile.
 *
 * Never throws — a failure here should never block order creation or
 * checkout. It just logs and moves on; the customer can be synced later.
 */
export async function syncCustomerToAudience(params: {
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<void> {
  try {
    const resend = getResendClient();
    const audienceId = getAudienceId();
    await resend.contacts.create({
      audienceId,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      unsubscribed: false,
    });
    // ⚠️ If this email is already in the Audience — e.g. they unsubscribed
    // earlier — `create` doesn't change them, so they'd stay unsubscribed
    // even though they just ticked "Email me about offers" again. Setting
    // it explicitly respects that new, deliberate opt-in.
    await resend.contacts.update({ audienceId, email: params.email, unsubscribed: false });
  } catch (error) {
    console.error("[resend] Failed to sync contact to audience:", error);
    // Intentionally swallowed — see doc comment above.
  }
}

/**
 * Removes a customer from the marketing Audience. Call this when a
 * customer unchecks the marketing consent checkbox in their profile.
 * (Resend also auto-removes contacts who click "unsubscribe" on a
 * broadcast — this function is only for the explicit in-app opt-out path.)
 */
export async function removeCustomerFromAudience(email: string): Promise<void> {
  try {
    const resend = getResendClient();
    await resend.contacts.remove({
      audienceId: getAudienceId(),
      email,
    });
  } catch (error) {
    console.error("[resend] Failed to remove contact from audience:", error);
  }
}

/**
 * Creates and immediately sends a Broadcast to the entire marketing
 * Audience. Used by the /admin/marketing "Send to All Subscribers" flow.
 *
 * Unlike the sync/remove helpers above, this one DOES throw on failure —
 * the admin UI needs to know if the send failed so it can show an error
 * instead of a false "sent!" confirmation.
 */
export type OfferEmailParams = {
  subject: string;
  headline: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  /** A running product offer to show as a card — see OfferBroadcastEmail. */
  featured?: FeaturedOfferEmail | null;
};

// Render the branded template to HTML ourselves (rather than relying on
// whatever "react" support broadcasts.create may or may not have) so this
// works reliably regardless of Resend SDK version.
function renderOfferEmail(
  params: OfferEmailParams,
  unsubscribeUrl: string | null
): Promise<string> {
  return render(
    OfferBroadcastEmail({
      unsubscribeUrl,
      headline: params.headline,
      bodyHtml: params.bodyHtml,
      ctaText: params.ctaText,
      ctaUrl: params.ctaUrl,
      previewText: params.subject,
      featured: params.featured ?? null,
    })
  );
}

/**
 * "Send Test to Me" on /admin/marketing — the exact same email, sent only
 * to the staff member's own inbox, so they can check it before it goes to
 * every subscriber. Subject starts with "[Test]" so it's never mistaken
 * for the real send.
 */
export async function sendOfferTestEmail(
  to: string,
  params: OfferEmailParams
): Promise<{ id: string }> {
  const resend = getResendClient();
  const html = await renderOfferEmail(params, null);
  const sent = await resend.emails.send({
    from: MARKETING_EMAIL_FROM,
    to,
    subject: `[Test] ${params.subject}`,
    html,
  });
  if (sent.error) {
    throw new Error(`Failed to send test email: ${sent.error.message}`);
  }
  return { id: sent.data!.id };
}

export async function sendOfferBroadcast(
  params: OfferEmailParams
): Promise<{ broadcastId: string }> {
  const resend = getResendClient();
  // Resend replaces this with each contact's own unsubscribe link.
  const html = await renderOfferEmail(params, "{{{RESEND_UNSUBSCRIBE_URL}}}");

  const created = await resend.broadcasts.create({
    audienceId: getAudienceId(),
    from: MARKETING_EMAIL_FROM,
    subject: params.subject,
    html,
    // Shown as the broadcast's internal name in the Resend dashboard —
    // purely cosmetic, doesn't affect what recipients see. Falls back to
    // the subject so broadcasts aren't left as "Untitled" in the list.
    name: params.subject,
    // Resend automatically injects the unsubscribe link/header (RFC 8058)
    // into broadcast sends — no manual unsubscribe link needed in `html`.
  });

  if (created.error) {
    throw new Error(`Failed to create broadcast: ${created.error.message}`);
  }

  const broadcastId = created.data!.id;

  const sent = await resend.broadcasts.send(broadcastId);
  if (sent.error) {
    throw new Error(`Failed to send broadcast: ${sent.error.message}`);
  }

  return { broadcastId };
}

export type AudienceStats = {
  /** Contacts who will get the next broadcast. */
  subscribed: number;
  /** Contacts who clicked "Unsubscribe" (Resend skips them). */
  unsubscribed: number;
  /** True if the list was too long to count fully — shown as "5,000+". */
  capped: boolean;
};

const AUDIENCE_PAGE_SIZE = 100;
const AUDIENCE_MAX_PAGES = 50; // 5,000 contacts

/**
 * How many people a broadcast will actually reach — counted in the Resend
 * Audience itself, the list broadcasts are sent to.
 *
 * This is the industry-standard source of truth: the email provider owns
 * the subscription state. Unsubscribes happen on Resend's own page (and
 * through the one-click unsubscribe in Gmail/Apple Mail), so our database
 * never hears about them — counting `User.marketingConsent` would keep
 * showing people who already left, and would miss guests who opted in at
 * checkout.
 *
 * Returns null if Resend can't be reached; the page then falls back to the
 * database count and says so.
 */
export async function getAudienceStats(): Promise<AudienceStats | null> {
  try {
    const resend = getResendClient();
    const audienceId = getAudienceId();

    let subscribed = 0;
    let unsubscribed = 0;
    let after: string | undefined;

    for (let page = 0; page < AUDIENCE_MAX_PAGES; page++) {
      const result = await resend.contacts.list({
        audienceId,
        limit: AUDIENCE_PAGE_SIZE,
        ...(after ? { after } : {}),
      });
      if (result.error || !result.data) {
        console.error("[resend] Failed to list audience contacts:", result.error);
        return null;
      }

      for (const contact of result.data.data) {
        if (contact.unsubscribed) unsubscribed++;
        else subscribed++;
      }

      const last = result.data.data.at(-1);
      if (!result.data.has_more || !last) {
        return { subscribed, unsubscribed, capped: false };
      }
      after = last.id;
    }

    return { subscribed, unsubscribed, capped: true };
  } catch (error) {
    console.error("[resend] Failed to count audience contacts:", error);
    return null;
  }
}
