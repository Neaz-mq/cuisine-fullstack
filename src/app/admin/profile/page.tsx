import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import PasswordForm from "@/components/account/PasswordForm";

export const metadata: Metadata = { title: "My Profile" };

/**
 * /admin/profile — a staff member's own profile (admin topbar → Profile).
 *
 * Any active staff role can open it (requireAdmin = "is staff", no
 * section permission needed): everyone needs to be able to change their
 * own password.
 *
 * Name, role and work phone are shown but managed by the owner/manager
 * on the Staff page — a waiter shouldn't be able to promote themselves or
 * rename their account on the rota.
 *
 * Staff don't get the customer panel (orders, rewards, addresses): staff
 * accounts are for work. See SiteNavbar.tsx.
 */

function roleLabel(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function AdminProfilePage() {
  const session = await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: session.user!.id },
    select: {
      name: true,
      email: true,
      image: true,
      role: true,
      password: true,
      createdAt: true,
      staffProfile: { select: { phone: true } },
    },
  });
  if (!user) return null;

  const name = user.name?.trim() || user.email.split("@")[0];
  const rows = [
    { label: "Name", value: name },
    { label: "Email", value: user.email },
    { label: "Role", value: roleLabel(user.role) },
    { label: "Work phone", value: user.staffProfile?.phone || "—" },
    {
      label: "Member since",
      value: user.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-frank-ruhl text-[26px] font-semibold leading-tight tracking-[-0.01em] text-black md:text-[32px]">
          My Profile
        </h1>
        <p className="mt-2 font-sora text-[13px] text-black/60">Your staff account and password.</p>
      </div>

      <section className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-6">
        <div className="flex min-w-0 items-center gap-4">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- Google avatar URL, same as AdminTopbar
            <img
              src={user.image}
              alt=""
              width={56}
              height={56}
              referrerPolicy="no-referrer"
              className="h-14 w-14 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black font-sora text-[20px] font-semibold text-white">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-sora text-[16px] font-semibold text-black">{name}</p>
            <span className="mt-1 inline-block rounded-full bg-[#F9F6F3] px-3 py-1 font-sora text-[11px] font-semibold text-black">
              {roleLabel(user.role)}
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="min-w-0 rounded-[14px] bg-[#F9F6F3] px-4 py-3">
              <dt className="font-sora text-[11px] text-black/55">{row.label}</dt>
              <dd className="mt-0.5 truncate font-sora text-[14px] text-black">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="font-sora text-[12px] text-black/55">
          Your name, role and work phone are managed by the owner or a manager on the Staff page.
        </p>
      </section>

      <PasswordForm hasPassword={Boolean(user.password)} tone="white" />
    </div>
  );
}
