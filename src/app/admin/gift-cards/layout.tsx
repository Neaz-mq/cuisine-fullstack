import { requireStaff } from "@/lib/require-admin";

// Section-level access gate: any staff role can get past the generic
// admin sign-in (see admin/layout.tsx), but only roles with the
// "giftCards" scope may see anything under /admin/gift-cards. A staff
// member without this scope who navigates here directly gets bounced
// back to /admin, same as if the nav link had never been shown.
export default async function GiftCardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff("giftCards");
  return <>{children}</>;
}
