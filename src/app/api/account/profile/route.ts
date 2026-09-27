import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations/parse";
import { profileSchema } from "@/lib/validations/account";
import { checkRateLimit } from "@/lib/rate-limit";
import { removeCustomerFromAudience, syncCustomerToAudience } from "@/lib/resend";

/**
 * PATCH /api/account/profile — the signed-in customer's own name, phone
 * and "email me offers" choice (customer panel → Profile).
 *
 * Only ever touches the caller's own row (id from the session, never
 * from the body). Email isn't editable here — see validations/account.ts.
 *
 * Turning offers on/off also updates the Resend marketing list, the same
 * list the checkout checkbox and /admin/marketing use, so the choice is
 * respected everywhere straight away.
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const rate = checkRateLimit(request, "account-profile", { limit: 20, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many changes — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = await parseBody(request, profileSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, marketingConsent: true },
    });
    if (!current) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const consentChanged = current.marketingConsent !== parsed.marketingConsent;
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: parsed.name,
        phone: parsed.phone || null,
        marketingConsent: parsed.marketingConsent,
        ...(consentChanged ? { marketingConsentAt: new Date() } : {}),
      },
      select: { name: true, phone: true, marketingConsent: true },
    });

    if (consentChanged) {
      const [firstName, ...rest] = parsed.name.split(" ");
      if (parsed.marketingConsent) {
        await syncCustomerToAudience({ email: current.email, firstName, lastName: rest.join(" ") || undefined });
      } else {
        await removeCustomerFromAudience(current.email);
      }
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("[account/profile] update failed:", error);
    return NextResponse.json({ error: "Couldn't save your details. Please try again." }, { status: 500 });
  }
}
