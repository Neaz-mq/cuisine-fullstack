import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ADDRESS_SELECT } from "@/lib/validations/account";
import AddressBook from "@/components/account/AddressBook";

export const metadata: Metadata = { title: "Saved Addresses" };

/**
 * src/app/(main)/account/addresses/page.tsx — customer panel → Saved Addresses.
 *
 * The address book checkout offers as one-tap chips ("Deliver to a saved
 * address"). The default one is filled in automatically.
 */
export default async function AddressesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/addresses");

  const addresses = await prisma.customerAddress.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: ADDRESS_SELECT,
  });

  return <AddressBook initial={addresses} />;
}
