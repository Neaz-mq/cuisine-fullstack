import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { riderVehicleSchema } from "@/lib/validations/delivery";

/**
 * PATCH /api/rider/vehicle — Profile → Vehicle (rider panel).
 *
 * The rider keeps their own vehicle details up to date — the one part of
 * their staff record they edit themselves (name, phone, role … stay with
 * the owner/manager on the Staff page).
 */
export async function PATCH(request: Request) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(request, riderVehicleSchema);
  if (parsed instanceof NextResponse) return parsed;

  const data = {
    vehicleType: parsed.vehicleType || null,
    vehicleModel: parsed.vehicleModel || null,
    vehiclePlate: parsed.vehiclePlate || null,
  };

  const { count } = await prisma.staffProfile.updateMany({ where: { userId: authResult.user.id! }, data });
  if (count === 0) {
    return NextResponse.json(
      { error: "Your staff profile isn't set up yet — ask the restaurant to add it on the Staff page." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, ...data });
}
