import { prisma } from "@/lib/prisma";

/**
 * src/lib/staff.ts
 *
 * Generates the next human-facing employee ID ("EMP-0001", "EMP-0002", ...)
 * for a new staff member. Sequential and zero-padded to 4 digits so it
 * reads consistently in the Staff UI even after 9999+ hires (it just grows
 * past 4 digits at that point, same as most invoice-number schemes).
 *
 * There's a small theoretical race if two staff members are created in the
 * same instant (both read the same "highest so far" and try to insert the
 * same next ID) — acceptable for an infrequent admin operation. The Staff
 * create route retries once on a unique-constraint conflict rather than
 * guarding this with a transaction/lock, which would be overkill here.
 */
export async function nextEmployeeId(): Promise<string> {
  const last = await prisma.staffProfile.findFirst({
    orderBy: { employeeId: "desc" },
    select: { employeeId: true },
  });

  const lastNumber = last ? parseInt(last.employeeId.replace("EMP-", ""), 10) : 0;
  const next = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;

  return `EMP-${String(next).padStart(4, "0")}`;
}
