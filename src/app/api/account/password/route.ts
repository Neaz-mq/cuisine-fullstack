import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations/parse";
import { passwordSchema } from "@/lib/validations/account";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/account/password — change (or, for a Google account, set)
 * the signed-in customer's password.
 *
 * ⚠️ If the account already has a password, the current one must be
 * given and must match. Otherwise anyone who found an unlocked, signed-in
 * phone could change it and lock the owner out.
 *
 * Tightly rate-limited: guessing the current password here would be a
 * back door around the login page's own limits.
 *
 * Any unused "forgot password" links are deleted afterwards — an old
 * emailed link shouldn't still work after a deliberate change.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const rate = checkRateLimit(request, "account-password", { limit: 5, windowMs: 15 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = await parseBody(request, passwordSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    if (user.password) {
      if (!parsed.currentPassword) {
        return NextResponse.json({ error: "Please enter your current password." }, { status: 400 });
      }
      const matches = await bcrypt.compare(parsed.currentPassword, user.password);
      if (!matches) {
        return NextResponse.json({ error: "Your current password is not correct." }, { status: 400 });
      }
      if (await bcrypt.compare(parsed.newPassword, user.password)) {
        return NextResponse.json(
          { error: "The new password must be different from the current one." },
          { status: 400 }
        );
      }
    }

    const hashed = await bcrypt.hash(parsed.newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: session.user.id }, data: { password: hashed } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: session.user.id } }),
    ]);

    return NextResponse.json({ ok: true, hadPassword: Boolean(user.password) });
  } catch (error) {
    console.error("[account/password] change failed:", error);
    return NextResponse.json({ error: "Couldn't change your password. Please try again." }, { status: 500 });
  }
}
