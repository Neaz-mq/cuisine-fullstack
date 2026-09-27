import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations/parse";
import { ADDRESS_SELECT, addressSchema } from "@/lib/validations/account";

/**
 * /api/account/addresses/[id] — edit or delete one saved address.
 *
 * ⚠️ Every query is scoped to `{ id, userId }`: someone else's address id
 * simply isn't found (404), so ids can't be used to read or change
 * another customer's addresses.
 *
 * Deleting the default passes "default" on to the most recently used
 * remaining address, so checkout always has one to suggest.
 */

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const parsed = await parseBody(request, addressSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const address = await prisma.$transaction(async (tx) => {
      const existing = await tx.customerAddress.findFirst({ where: { id, userId }, select: { isDefault: true } });
      if (!existing) return null;

      // Un-ticking "default" on the only default is ignored — there must
      // always be one. It moves only when another address is made default.
      const makeDefault = parsed.isDefault || existing.isDefault;
      if (makeDefault && !existing.isDefault) {
        await tx.customerAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.customerAddress.update({
        where: { id },
        data: {
          label: parsed.label,
          address: parsed.address,
          apartment: parsed.apartment || null,
          city: parsed.city,
          state: parsed.state,
          zip: parsed.zip,
          isDefault: makeDefault,
        },
        select: ADDRESS_SELECT,
      });
    });

    if (!address) return NextResponse.json({ error: "Address not found." }, { status: 404 });
    return NextResponse.json({ address });
  } catch (error) {
    console.error("[account/addresses] update failed:", error);
    return NextResponse.json({ error: "Couldn't save this address. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.customerAddress.findFirst({ where: { id, userId }, select: { isDefault: true } });
      if (!existing) return false;
      await tx.customerAddress.delete({ where: { id } });

      if (existing.isDefault) {
        const next = await tx.customerAddress.findFirst({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        });
        if (next) await tx.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
      }
      return true;
    });

    if (!deleted) return NextResponse.json({ error: "Address not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[account/addresses] delete failed:", error);
    return NextResponse.json({ error: "Couldn't delete this address. Please try again." }, { status: 500 });
  }
}
 