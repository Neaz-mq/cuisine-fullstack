import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations/parse";
import { preferencesSchema } from "@/lib/validations/account";
import { checkRateLimit } from "@/lib/rate-limit";
import { removeCustomerFromAudience, syncCustomerToAudience } from "@/lib/resend";

/**
 * PATCH /api/account/preferences — the notification switches on Profile
 * Details (Figma "Preferences"). Send only the switches that changed:
 *
 *   { orderUpdates?, marketingConsent? }
 *
 *   orderUpdates     — "Order Updates": emails when the order is on its
 *                      way, delivered or cancelled (lib/send-order-status-email.ts).
 *   marketingConsent — "Promotions & Offers": the same opt-in as the
 *                      checkout checkbox. Also added to / removed from the
 *                      Resend marketing list, like before.
 *
 * Returns both, as saved.
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const rate = checkRateLimit(request, "account-preferences", { limit: 40, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many changes — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = await parseBody(request, preferencesSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true, marketingConsent: true },
    });
    if (!current) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const consentChanged =
      typeof parsed.marketingConsent === "boolean" && parsed.marketingConsent !== current.marketingConsent;

    const saved = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(typeof parsed.orderUpdates === "boolean" ? { notifyOrderUpdates: parsed.orderUpdates } : {}),
        ...(consentChanged ? { marketingConsent: parsed.marketingConsent, marketingConsentAt: new Date() } : {}),
      },
      select: { notifyOrderUpdates: true, marketingConsent: true },
    });

    if (consentChanged) {
      const [firstName, ...rest] = (current.name ?? "").trim().split(" ");
      if (saved.marketingConsent) {
        await syncCustomerToAudience({
          email: current.email,
          firstName: firstName || undefined,
          lastName: rest.join(" ") || undefined,
        });
      } else {
        await removeCustomerFromAudience(current.email);
      }
    }

    return NextResponse.json({
      orderUpdates: saved.notifyOrderUpdates,
      marketingConsent: saved.marketingConsent,
    });
  } catch (error) {
    console.error("[account/preferences] update failed:", error);
    return NextResponse.json({ error: "Couldn't save this setting. Please try again." }, { status: 500 });
  }
}
