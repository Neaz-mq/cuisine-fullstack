import { Resend } from "resend";

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
    await resend.contacts.create({
      audienceId: getAudienceId(),
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      unsubscribed: false,
    });
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
export async function sendOfferBroadcast(params: {
  subject: string;
  html: string;
}): Promise<{ broadcastId: string }> {
  const resend = getResendClient();

  const created = await resend.broadcasts.create({
    audienceId: getAudienceId(),
    from: MARKETING_EMAIL_FROM,
    subject: params.subject,
    html: params.html,
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