// src/app/api/admin/marketing/broadcast/route.ts
import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { sendOfferBroadcast } from "@/lib/resend";

export async function POST(request: Request) {
  // ⚠️ "marketing" needs to exist as a valid scope string in your
  // permissions.ts / require-admin.ts — same pattern as "orders" in
  // src/app/api/orders/route.ts. If you haven't added a MARKETING scope
  // yet, temporarily swap this for a scope you know exists (e.g. "orders")
  // just to unblock testing, then add the real scope afterward.
  const authResult = await requireApiScope("marketing");
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { subject, html } = body as { subject?: string; html?: string };

    if (!subject?.trim() || !html?.trim()) {
      return NextResponse.json(
        { error: "Subject and message body are required" },
        { status: 400 }
      );
    }

    const result = await sendOfferBroadcast({ subject, html });
    return NextResponse.json({ success: true, broadcastId: result.broadcastId });
  } catch (error) {
    console.error("POST /api/admin/marketing/broadcast error:", error);
    return NextResponse.json(
      { error: "Failed to send broadcast. Check server logs." },
      { status: 500 }
    );
  }
}