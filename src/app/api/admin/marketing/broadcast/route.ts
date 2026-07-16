// src/app/api/admin/marketing/broadcast/route.ts
import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { sendOfferBroadcast } from "@/lib/resend";
import { plainTextToHtml } from "@/lib/plain-text-to-html";
import { broadcastSchema } from "@/lib/validations/admin";
import { parseBody } from "@/lib/validations/parse";

export async function POST(request: Request) {
  const authResult = await requireApiScope("marketing");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(request, broadcastSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { subject, headline, message, ctaText, ctaUrl } = parsed;

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const result = await sendOfferBroadcast({
      subject,
      // Headline is the large hero text shown at the top of the email —
      // falls back to the subject line so this field stays optional in
      // the admin UI without breaking the template.
      headline: headline?.trim() || subject,
      // Admins type plain text (no HTML knowledge required) — converted
      // to safe paragraph HTML here before it reaches the email template.
      bodyHtml: plainTextToHtml(message),
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
