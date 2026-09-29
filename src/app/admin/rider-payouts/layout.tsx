import { requireStaff } from "@/lib/require-admin";

// The riders' cash-out requests are the restaurant's money going out, so
// the same authority as the money totals: "finance" (the owner).
export default async function RiderPayoutsLayout({ children }: { children: React.ReactNode }) {
  await requireStaff("finance");
  return <>{children}</>;
}
