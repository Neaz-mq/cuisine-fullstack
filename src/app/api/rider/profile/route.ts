import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseBirthDate } from "@/lib/validations/account";
import { riderProfileSchema } from "@/lib/validations/delivery";

/**
 * PATCH /api/rider/profile — Rider panel → My Profile → "Save Change".
 *
 * The rider keeps their own details up to date: name, phone, permanent
 * address, date of birth, gender, vehicle and driving licence number.
 * Email is the login (not here). NID is set once — after that only the
 * restaurant changes it on the Staff page. Role, shift, salary: never here.
 */
export async function PATCH(request: Request) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;
  const riderId = authResult.user.id!;

  const rate = checkRateLimit(request, "rider-profile", { limit: 20, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many changes — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = await parseBody(request, riderProfileSchema);
  if (parsed instanceof NextResponse) return parsed;

  const profile = await prisma.staffProfile.findUnique({ where: { userId: riderId }, select: { nid: true } });
  if (!profile) {
    return NextResponse.json(
      { error: "Your staff profile isn't set up yet — ask the restaurant to add it on the Staff page." },
      { status: 404 }
    );
  }
  if (profile.nid && parsed.nid && parsed.nid !== profile.nid) {
    return NextResponse.json(
      { error: "Your NID is already on file. Ask the restaurant to change it." },
      { status: 403 }
    );
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: riderId },
        data: {
          name: parsed.name,
          dateOfBirth: parsed.dateOfBirth ? parseBirthDate(parsed.dateOfBirth) : null,
          gender: parsed.gender || null,
        },
      }),
      prisma.staffProfile.update({
        where: { userId: riderId },
        data: {
          phone: parsed.phone || null,
          address: parsed.address || null,
          ...(profile.nid ? {} : { nid: parsed.nid || null }),
          vehicleType: parsed.vehicleType || null,
          vehicleModel: parsed.vehicleModel || null,
          vehiclePlate: parsed.vehiclePlate || null,
          drivingLicenseNumber: parsed.drivingLicenseNumber || null,
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[rider/profile] update failed:", error);
    return NextResponse.json({ error: "Couldn't save your details. Please try again." }, { status: 500 });
  }
}
