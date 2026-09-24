/**
 * src/lib/prisma-errors.ts
 *
 * P2025 = "the record to update was not found". We get it on purpose when an
 * update's WHERE includes the status we read a moment earlier
 * (`where: { id, status: existing.status }`) and another request changed
 * that status in between. Postgres locks the row during the UPDATE, so of
 * two simultaneous requests exactly one wins and the other lands here.
 */
export function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2025"
  );
}

/** P2002 = a unique column (e.g. Coupon.code) already has this value. */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}
