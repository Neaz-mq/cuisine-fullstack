import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { splitE164 } from "@/lib/checkout-profile";
import { getRestaurantSettings } from "@/lib/get-settings";
import { isUploadedAvatar } from "@/lib/avatar";
import { GENDER_OPTIONS } from "@/lib/validations/account";
import ProfileForm from "@/components/account/ProfileForm";
import PreferencesCard from "@/components/account/PreferencesCard";

export const metadata: Metadata = { title: "Profile Details" };

/**
 * src/app/(main)/account/profile/page.tsx — customer panel → Profile Details.
 *
 * Figma: two white cards, 60px apart.
 *   1. Profile Details — photo (Change Photo), name, phone, email
 *      (read-only — it's the login), date of birth, gender.
 *   2. Preferences — Order Updates and Promotions & Offers, each saved
 *      the moment it's switched.
 */
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/profile");

  const [user, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        phone: true,
        image: true,
        password: true,
        createdAt: true,
        dateOfBirth: true,
        gender: true,
        marketingConsent: true,
        notifyOrderUpdates: true,
      },
    }),
    getRestaurantSettings(),
  ]);
  if (!user) redirect("/login");

  const phone = user.phone ? splitE164(user.phone) : null;
  const memberSince = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: settings.timezone,
  }).format(user.createdAt);
  // "Today" in the restaurant's time zone — the latest birth date allowed.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: settings.timezone }).format(new Date());
  const knownGender = GENDER_OPTIONS.some((option) => option.value === user.gender) ? (user.gender as string) : "";

  return (
    <>
      <ProfileForm
        today={today}
        initial={{
          name: user.name ?? "",
          email: user.email,
          image: user.image,
          phoneCountryCode: phone?.countryCode ?? null,
          phoneNumber: phone?.number ?? "",
          // @db.Date comes back as midnight UTC — the ISO date part is the day.
          dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : "",
          gender: knownGender,
          memberSinceLabel: memberSince,
          // No password = the account only ever signs in with Google.
          signedInWithGoogle: !user.password || Boolean(user.image?.includes("googleusercontent")),
          hasUploadedPhoto: isUploadedAvatar(user.image),
        }}
      />

      <PreferencesCard
        initial={{
          orderUpdates: user.notifyOrderUpdates,
          marketingConsent: user.marketingConsent,
        }}
      />
    </>
  );
}
