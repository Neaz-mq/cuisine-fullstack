// src/app/api/admin/marketing/broadcast/route.ts
import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { sendOfferBroadcast } from "@/lib/resend";

export async function POST(request: Request) {
  const authResult = await requireApiScope("marketing");
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { subject, headline, html, ctaText, ctaUrl } = body as {
      subject?: string;
      headline?: string;
      html?: string;
      ctaText?: string;
      ctaUrl?: string;
    };

    if (!subject?.trim() || !html?.trim()) {
      return NextResponse.json(
        { error: "Subject and message body are required" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const result = await sendOfferBroadcast({
      subject: subject.trim(),
      // Headline is the large hero text shown at the top of the email —
      // falls back to the subject line so this field stays optional in
      // the admin UI without breaking the template.
      headline: headline?.trim() || subject.trim(),
      bodyHtml: html,
      ctaText: ctaText?.trim() || "Order Now",
      ctaUrl: ctaUrl?.trim() || appUrl,
    });

    return NextResponse.json({ success: true, broadcastId: result.broadcastId });
  } catch (error) {
    console.error("POST /api/admin/marketing/broadcast error:", error);
    return NextResponse.json(
      { error: "Failed to send broadcast. Check server logs." },
      { status: 500 }
    );
  }
}