import ComingSoon from "@/components/admin/ComingSoon";

export const metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <ComingSoon
      title="Users"
      description="A customer directory — accounts, order history, loyalty balance and marketing consent in one place. Not built yet; staff accounts are managed separately under Staff."
      action={{ label: "Go to Staff", href: "/admin/staff" }}
    />
  );
}