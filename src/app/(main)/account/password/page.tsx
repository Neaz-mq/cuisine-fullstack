import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/account";
import PasswordForm from "@/components/account/PasswordForm";
import SecurityCard from "@/components/account/SecurityCard";

export const metadata: Metadata = { title: "Change Password" };

/**
 * src/app/(main)/account/password/page.tsx — customer panel → Change Password.
 *
 * Figma: two white cards, 60px apart.
 *   1. Change Password — current / new / confirm, strength, rules checklist.
 *   2. Account Security — when the password last changed, and the
 *      Two-Factor Authentication switch (emailed sign-in code).
 */
export default async function PasswordPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/password");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, password: true, passwordChangedAt: true, twoFactorEnabled: true },
  });
  if (!user) redirect("/login");

  const hasPassword = Boolean(user.password);
  const lastChangeLabel = !hasPassword
    ? "No password yet"
    : user.passwordChangedAt
      ? timeAgo(user.passwordChangedAt)
      : "Not changed yet";

  return (
    <>
      <PasswordForm hasPassword={hasPassword} />
      <SecurityCard
        lastChangeLabel={lastChangeLabel}
        twoFactorEnabled={user.twoFactorEnabled}
        hasPassword={hasPassword}
        email={user.email}
      />
    </>
  );
}
