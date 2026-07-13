import { requireStaff } from "@/lib/require-admin";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff("staff");
  return <>{children}</>;
}
