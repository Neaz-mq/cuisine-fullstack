import { createHash, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/send-email";
import LoginCodeEmail from "@/emails/LoginCodeEmail";

/**
 * src/lib/login-code.ts
 *
 * Two-step sign-in (Change Password → Two-Factor Authentication).
 *
 *   LOGIN      — after the right email + password, a 6-digit code goes to
 *                the account's email and must be typed in (auth.ts).
 *   ENABLE_2FA — sent when the customer switches it on; it's only switched
 *                on once they type the code back. That proves the emails
 *                arrive, so nobody locks themselves out.
 *
 * Only a SHA-256 of the code is stored, salted with the user id and the
 * app secret. A code lasts 10 minutes and allows 5 wrong tries. A new
 * code replaces older ones of the same purpose.
 */

export type LoginCodePurpose = "LOGIN" | "ENABLE_2FA";

export const LOGIN_CODE_TTL_MS = 10 * 60_000;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;

export function makeLoginCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashLoginCode(userId: string, code: string): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  return createHash("sha256").update(`${userId}:${code.trim()}:${secret}`).digest("hex");
}

/** Creates a fresh code (dropping older ones) and emails it. false = the email didn't go. */
export async function sendLoginCode(
  user: { id: string; email: string; name: string | null },
  purpose: LoginCodePurpose
): Promise<boolean> {
  const code = makeLoginCode();
  await prisma.$transaction([
    prisma.loginCode.deleteMany({ where: { userId: user.id, purpose } }),
    prisma.loginCode.create({
      data: {
        userId: user.id,
        purpose,
        codeHash: hashLoginCode(user.id, code),
        expiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MS),
      },
    }),
  ]);

  // Retries, plain text and the log line: lib/send-email.ts.
  const result = await sendEmail({
    tag: "login-code",
    to: user.email,
    subject: purpose === "LOGIN" ? `${code} is your Cuisine sign-in code` : `${code} is your Cuisine verification code`,
    react: LoginCodeEmail({
      firstName: user.name?.trim().split(" ")[0] || "there",
      code,
      purpose,
      minutes: Math.round(LOGIN_CODE_TTL_MS / 60_000),
    }),
  });
  return result.ok;
}

/**
 * Checks a typed code. On success the code is used up (deleted).
 * "invalid" also counts a wrong try; after 5, the code stops working.
 */
export async function verifyLoginCode(
  userId: string,
  purpose: LoginCodePurpose,
  code: string
): Promise<"ok" | "invalid" | "expired"> {
  const record = await prisma.loginCode.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.expiresAt.getTime() < Date.now() || record.attempts >= LOGIN_CODE_MAX_ATTEMPTS) {
    return "expired";
  }
  if (!/^\d{6}$/.test(code.trim()) || hashLoginCode(userId, code) !== record.codeHash) {
    await prisma.loginCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return "invalid";
  }
  await prisma.loginCode.deleteMany({ where: { userId, purpose } });
  return "ok";
}
