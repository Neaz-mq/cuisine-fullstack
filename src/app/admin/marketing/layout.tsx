import { requireStaff } from "@/lib/require-admin";

// Section-level access gate: any staff role can get past the generic
// admin sign-in (see admin/layout.tsx), but only roles with the "marketing"
// scope may see anything under /admin/marketing. A staff member without this
// scope who navigates here directly (e.g. via a stale bookmark or by typing
// the URL) gets bounced back to /admin, same as if the nav link had never
// been shown.
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff("marketing");
  return <>{children}</>;
}