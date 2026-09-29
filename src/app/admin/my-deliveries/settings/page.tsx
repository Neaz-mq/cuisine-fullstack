import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { timeAgo } from "@/lib/account";
import PasswordForm from "@/components/account/PasswordForm";
import SecurityCard from "@/components/account/SecurityCard";
import { RiderPageHeader } from "../rider-ui";

export const metadata = { title: "Settings" };

/**
 * Rider panel → Settings: the rider's sign-in security — change password
 * and two-step sign-in (a code emailed at every password sign-in). The
 * same forms and APIs as the customer's Change Password page.
 *
 * Name, phone and vehicle are on Profile.
 */
export default async function RiderSettingsPage() {
  const session = await requireStaff("myDeliveries");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
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
    <div className="flex flex-col gap-4">
      <RiderPageHeader title="Settings" subtitle="Your password and sign-in security." now={new Date()} />
      <PasswordForm hasPassword={hasPassword} tone="white" />
      <SecurityCard
        lastChangeLabel={lastChangeLabel}
        twoFactorEnabled={user.twoFactorEnabled}
        hasPassword={hasPassword}
        email={user.email}
      />
    </div>
  );
}
