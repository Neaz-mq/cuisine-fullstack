import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations/parse";
import { ADDRESS_SELECT, addressSchema, MAX_SAVED_ADDRESSES } from "@/lib/validations/account";

/**
 * /api/account/addresses — the signed-in customer's address book.
 *
 *   GET  → their saved addresses, default first
 *   POST → add one
 *
 * The first address saved is always the default. Saving a new one with
 * "Set as default" moves the default to it, in one transaction, so there
 * is never a moment with two defaults (or none).
 */

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const addresses = await prisma.customerAddress.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: ADDRESS_SELECT,
  });
  return NextResponse.json({ addresses }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const userId = session.user.id;

  const parsed = await parseBody(request, addressSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const address = await prisma.$transaction(async (tx) => {
      const count = await tx.customerAddress.count({ where: { userId } });
      if (count >= MAX_SAVED_ADDRESSES) return null;

      const makeDefault = parsed.isDefault || count === 0;
      if (makeDefault) {
        await tx.customerAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.customerAddress.create({
        data: {
          userId,
          label: parsed.label,
          address: parsed.address,
          apartment: parsed.apartment || null,
          city: parsed.city,
          state: parsed.state,
          zip: parsed.zip,
          phone: parsed.phone || null,
          isDefault: makeDefault,
        },
        select: ADDRESS_SELECT,
      });
    });

    if (!address) {
      return NextResponse.json(
        { error: `You can save up to ${MAX_SAVED_ADDRESSES} addresses. Delete one to add another.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ address }, { status: 201 });
  } catch (error) {
    console.error("[account/addresses] create failed:", error);
    return NextResponse.json({ error: "Couldn't save this address. Please try again." }, { status: 500 });
  }
}
