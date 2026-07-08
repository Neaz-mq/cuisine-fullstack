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