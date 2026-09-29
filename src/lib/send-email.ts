/**
 * src/lib/send-email.ts
 *
 * The one way this app sends a transactional email (password reset, sign-in
 * code, order confirmation, order status). Everything that made emails go
 * missing without a trace is handled here once:
 *
 *   1. Resend doesn't throw when it refuses an email — it returns
 *      `{ error }`. Both shapes are treated as a failure and logged with the
 *      real reason (describeEmailError), never swallowed.
 *   2. Short hiccups are retried: Resend's per-second rate limit (two quick
 *      emails, e.g. order confirmation + status), its 5xx errors and network
 *      drops — up to 3 tries. An Idempotency-Key makes a retry that did go
 *      through the first time not send a second copy.
 *      Permanent refusals (unverified domain, bad address, quota used up)
 *      are not retried — trying again can't fix them.
 *   3. A plain-text part is sent next to the HTML. An HTML-only email looks
 *      more like spam to Gmail/Outlook, so this puts more of our mail in the
 *      inbox.
 *   4. Every send logs one line — "sent" with Resend's id, or "failed" with
 *      the reason — with the address masked. Vercel → Logs then shows what
 *      happened to any email, and the id finds it in Resend → Emails.
 *
 * Never throws: callers run inside after() or next to a response that must
 * not change (forgot-password must answer the same for every address).
 */
import type { ReactElement } from "react";
import { render } from "@react-email/render";
import { EMAIL_FROM, describeEmailError, getResendClient, maskEmail } from "@/lib/resend";

export type SendEmailInput = {
  to: string;
  subject: string;
  react: ReactElement;
  /** Short label for the log line: "password-reset", "order-status" … */
  tag: string;
  from?: string;
  replyTo?: string;
  /** Same key = Resend sends it once, even if we retry. Keep it unique per email. */
  idempotencyKey?: string;
};

export type SendEmailResult = { ok: true; id: string } | { ok: false; reason: string };

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [600, 1800];

type ResendFailure = { name?: string; statusCode?: number | null; message?: string };

/** Worth another try? Only for problems that go away on their own. */
export function isRetryableEmailError(error: unknown): boolean {
  const e = (error ?? {}) as ResendFailure;
  // Quotas also answer 429, but they last until tomorrow / next month.
  if (e.name === "daily_quota_exceeded" || e.name === "monthly_quota_exceeded") return false;
  if (e.name === "rate_limit_exceeded" || e.statusCode === 429) return true;
  if (e.name === "application_error" || e.name === "internal_server_error") return true;
  if (typeof e.statusCode === "number" && e.statusCode >= 500) return true;
  // A thrown network error (fetch failed, socket hang up) has no Resend name.
  return error instanceof Error && !e.statusCode;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = input.to.trim();
  const who = maskEmail(to);

  let html: string;
  let text: string;
  try {
    [html, text] = await Promise.all([render(input.react), render(input.react, { plainText: true })]);
  } catch (error) {
    const reason = `couldn't build the email: ${describeEmailError(error)}`;
    console.error(`[email:${input.tag}] to ${who} failed — ${reason}`);
    return { ok: false, reason };
  }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { data, error } = await getResendClient().emails.send(
        {
          from: input.from ?? EMAIL_FROM,
          to,
          subject: input.subject,
          html,
          text,
          ...(input.replyTo ? { replyTo: input.replyTo } : {}),
        },
        input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
      );
      if (!error && data) {
        console.info(`[email:${input.tag}] sent to ${who} (resend id ${data.id})`);
        return { ok: true, id: data.id };
      }
      lastError = error;
    } catch (error) {
      lastError = error;
    }

    if (attempt < MAX_ATTEMPTS && isRetryableEmailError(lastError)) {
      await wait(RETRY_DELAYS_MS[attempt - 1] ?? 2000);
      continue;
    }
    break;
  }

  const reason = describeEmailError(lastError);
  console.error(`[email:${input.tag}] to ${who} failed — ${reason}`);
  return { ok: false, reason };
}
