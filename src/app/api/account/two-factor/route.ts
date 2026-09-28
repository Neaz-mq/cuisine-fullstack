import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations/parse";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendLoginCode, verifyLoginCode } from "@/lib/login-code";

/**
 * /api/account/two-factor — the "Two-Factor Authentication" switch on
 * Change Password.
 *
 *   POST { action: "start" }            email a 6-digit code (turning on)
 *   POST { action: "confirm", code }    right code → two-step sign-in is on
 *   DELETE { password }                 turn it off (needs the password, so
 *                                       an unlocked phone isn't enough)
 *
 * Needs an account password — two-step sign-in guards the email+password
 * login. Google sign-in is protected by Google.
 */

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("confirm"), code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") }),
]);
const deleteSchema = z.object({ password: z.string().max(200).optional().default("") });

async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, password: true, twoFactorEnabled: true },
  });
}

function limited(request: Request) {
  const rate = checkRateLimit(request, "account-two-factor", { limit: 8, windowMs: 15 * 60_000 });
  return rate.allowed
    ? null
    : NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
}

export async function POST(request: Request) {
  const tooMany = limited(request);
  if (tooMany) return tooMany;

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!user.password) {
    return NextResponse.json(
      { error: "Add a password first — two-step sign-in protects signing in with email and password." },
      { status: 400 }
    );
  }

  const parsed = await parseBody(request, postSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    if (parsed.action === "start") {
      if (user.twoFactorEnabled) return NextResponse.json({ enabled: true });
      const sent = await sendLoginCode(user, "ENABLE_2FA");
      if (!sent) {
        return NextResponse.json({ error: "We couldn't send the email. Please try again in a minute." }, { status: 502 });
      }
      return NextResponse.json({ sent: true, email: user.email });
    }

    const result = await verifyLoginCode(user.id, "ENABLE_2FA", parsed.code);
    if (result !== "ok") {
      return NextResponse.json(
        {
          error:
            result === "invalid"
              ? "That code isn't right. Please check the email and try again."
              : "That code has expired. Send a new one.",
        },
        { status: 400 }
      );
    }
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    return NextResponse.json({ enabled: true });
  } catch (error) {
    console.error("[account/two-factor] failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const tooMany = limited(request);
  if (tooMany) return tooMany;

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const parsed = await parseBody(request, deleteSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    if (user.password && !(await bcrypt.compare(parsed.password, user.password))) {
      return NextResponse.json({ error: "Your password is not correct." }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false } }),
      prisma.loginCode.deleteMany({ where: { userId: user.id } }),
    ]);
    return NextResponse.json({ enabled: false });
  } catch (error) {
    console.error("[account/two-factor] disable failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
