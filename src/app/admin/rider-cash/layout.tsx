import { requireStaff } from "@/lib/require-admin";

// Cash riders hand in is the restaurant's money coming back, so it has the
// same authority as Rider Payouts (money going out): "finance" (the owner).
export default async function RiderCashLayout({ children }: { children: React.ReactNode }) {
  await requireStaff("finance");
  return <>{children}</>;
}
