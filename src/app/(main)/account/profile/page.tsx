import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { splitE164 } from "@/lib/checkout-profile";
import ProfileForm from "@/components/account/ProfileForm";

export const metadata: Metadata = { title: "Profile Details" };

/**
 * src/app/(main)/account/profile/page.tsx — customer panel → Profile Details.
 *
 * Name and phone (pre-fill checkout; the number the rider calls), the
 * email the customer logs in with (read-only) and the offers opt-in.
 * Saved addresses and the password have their own pages in the sidebar,
 * as in Figma.
 */
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/profile");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true, marketingConsent: true, image: true },
  });
  if (!user) redirect("/login");

  const phone = user.phone ? splitE164(user.phone) : null;

  return (
    <ProfileForm
      initial={{
        name: user.name ?? "",
        email: user.email,
        phoneCountryCode: phone?.countryCode ?? null,
        phoneNumber: phone?.number ?? "",
        marketingConsent: user.marketingConsent,
        // A Google picture means the account was made with Google.
        signedInWithGoogle: Boolean(user.image?.includes("googleusercontent")),
      }}
    />
  );
}
