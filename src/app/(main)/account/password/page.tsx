import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import PasswordForm from "@/components/account/PasswordForm";

export const metadata: Metadata = { title: "Change Password" };

/**
 * src/app/(main)/account/password/page.tsx — customer panel → Change Password.
 *
 * Needs the current password when the account has one; a Google account
 * without one can add a password here (then it can log in with email too).
 */
export default async function PasswordPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/password");

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { password: true } });
  if (!user) redirect("/login");

  return <PasswordForm hasPassword={Boolean(user.password)} />;
}
