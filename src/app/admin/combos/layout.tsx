import { requireStaff } from "@/lib/require-admin";

// Combos are part of the menu: same "menu" scope as /admin/menu (OWNER + MANAGER).
export default async function CombosLayout({ children }: { children: React.ReactNode }) {
  await requireStaff("menu");
  return <>{children}</>;
}