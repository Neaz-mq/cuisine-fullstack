import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { checkRateLimit } from "@/lib/rate-limit";
import { getResendClient, EMAIL_FROM } from "@/lib/resend";
import ReviewReplyEmail from "@/emails/ReviewReplyEmail";

/**
 * POST /api/admin/reviews/[id]/reply  { message }
 *
 * The "Reply" button on /admin/reviews. Emails the customer from Cuisine's
 * own address through Resend — the same way order confirmations and
 * password resets go out.
 *
 * Before, Reply was a `mailto:` link: it opened whatever mail app the
 * staff member's computer had set as default, which on most Windows PCs
 * is an Outlook that was never set up — so it just showed a sign-in
 * screen and nothing was ever sent.
 *
 * If EMAIL_REPLY_TO is set in .env (e.g. the restaurant's inbox), the
 * customer's answer to this email goes there instead of to the
 * no-reply sending address.
 */
const replySchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Please write a reply first")
    .max(2000, "Please keep the reply under 2000 characters"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiScope("reviews");
  if (authResult instanceof NextResponse) return authResult;

  const rate = checkRateLimit(request, "review-reply", { limit: 20, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many replies in a short time. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = await parseBody(request, replySchema);
  if (parsed instanceof NextResponse) return parsed;

  const { id } = await params;
  const review = await prisma.review.findUnique({
    where: { id },
    select: {
      rating: true,
      comment: true,
      user: { select: { name: true, email: true } },
      menuItem: { select: { id: true, title: true } },
    },
  });

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  if (!review.user.email) {
    return NextResponse.json(
      { error: "This customer has no email address, so a reply can't be sent." },
      { status: 400 }
    );
  }

  const firstName = review.user.name?.trim().split(/\s+/)[0] || "there";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const subject = `Re: your review of ${review.menuItem.title}`;
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();

  try {
    const { error } = await getResendClient().emails.send({
      from: EMAIL_FROM,
      to: review.user.email,
      subject,
      ...(replyTo ? { replyTo } : {}),
      react: ReviewReplyEmail({
        firstName,
        itemTitle: review.menuItem.title,
        rating: review.rating,
        reviewComment: review.comment,
        message: parsed.message,
        itemUrl: `${appUrl}/menu/${review.menuItem.id}`,
        previewText: subject,
      }),
    });

    // Resend reports most problems (unverified domain, bad address) in
    // `error` rather than by throwing.
    if (error) {
      console.error("Review reply email was rejected by Resend:", error);
      return NextResponse.json(
        { error: "The email service couldn't send this reply. Please try again later." },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Review reply email failed:", error);
    return NextResponse.json(
      { error: "The email service couldn't send this reply. Please try again later." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, sentTo: review.user.email });
}
