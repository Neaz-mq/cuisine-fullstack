import { requireStaff } from "@/lib/require-admin";

// Section-level access gate, same as /admin/marketing: only roles with the
// "marketing" scope (OWNER, MANAGER) can open /admin/offers. Anyone else
// who types the URL is bounced back to /admin.
export default async function OffersLayout({ children }: { children: React.ReactNode }) {
  await requireStaff("marketing");
  return <>{children}</>;
}
