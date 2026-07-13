import { requireStaff } from "@/lib/require-admin";

// Section-level access gate: any staff role can get past the generic
// admin sign-in (see admin/layout.tsx), but only roles with the "tables"
// scope may see anything under /admin/tables. A staff member without this
// scope who navigates here directly (e.g. via a stale bookmark) gets
// bounced back to /admin, same as if the nav link had never been shown.
export default async function TablesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff("tables");
  return <>{children}</>;
}
