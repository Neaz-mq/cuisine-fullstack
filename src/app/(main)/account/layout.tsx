import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import AccountNav from "@/components/account/AccountNav";

export const metadata: Metadata = {
  title: { default: "My Account", template: "%s | My Account" },
  robots: { index: false, follow: false },
};

/**
 * src/app/(main)/account/layout.tsx — the customer panel.
 *
 * Figma "Web/My Account": cream page (#F9F6F3), "My Account" title
 * (Frank Ruhl 600, 40px), then the sidebar card (405px) and the page's
 * cards (815px) side by side, 60px apart. The site's navbar and footer
 * still wrap it.
 *
 * Signed-out visitors are already stopped by the middleware
 * (auth.config.ts → /account needs a login); the redirect here only
 * covers a session that expired between the two checks.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true },
  });
  if (!user) redirect("/login");

  return (
    <section className="w-full bg-[#F9F6F3]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 pb-16 pt-8 md:gap-8 md:px-10 md:pt-10 xl:gap-10 xl:px-0 xl:pb-[60px]">
        <h1 className="font-frank-ruhl text-[30px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[36px] xl:text-[40px]">
          My Account
        </h1>
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[405px_minmax(0,1fr)] xl:gap-[60px]">
          <AccountNav
            summary={{
              name: user.name?.trim() || user.email.split("@")[0],
              email: user.email,
              image: user.image,
            }}
          />
          <div className="flex min-w-0 flex-col gap-6 md:gap-8 xl:gap-[60px]">{children}</div>
        </div>
      </div>
    </section>
  );
}
