import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations/parse";
import { parseBirthDate, profileSchema } from "@/lib/validations/account";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * PATCH /api/account/profile — the signed-in customer's own Profile
 * Details: name, phone, date of birth and gender.
 *
 * Only ever touches the caller's own row (id from the session, never
 * from the body). Email isn't editable here — see validations/account.ts.
 * The email/notification switches have their own route
 * (/api/account/preferences), because each switch saves on its own.
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
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: parsed.name,
        phone: parsed.phone || null,
        dateOfBirth: parsed.dateOfBirth ? parseBirthDate(parsed.dateOfBirth) : null,
        gender: parsed.gender || null,
      },
      select: { name: true, phone: true, dateOfBirth: true, gender: true },
    });

    return NextResponse.json({
      ...user,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : "",
    });
  } catch (error) {
    console.error("[account/profile] update failed:", error);
    return NextResponse.json({ error: "Couldn't save your details. Please try again." }, { status: 500 });
  }
}
