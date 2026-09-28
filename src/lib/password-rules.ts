/**
 * src/lib/password-rules.ts
 *
 * The rules a new password must meet on Change Password (Figma checklist):
 *
 *   ✓ At least 8 characters
 *   ✓ One uppercase letter
 *   ✓ One number or symbol
 *
 * Shared by the form (ticks turn orange as they're met) and by the API
 * (passwordSchema), so both always agree. Pure — no imports.
 */

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES = [
  { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (pw: string) => pw.length >= PASSWORD_MIN_LENGTH },
  { id: "upper", label: "One uppercase letter", test: (pw: string) => /[A-Z]/.test(pw) },
  { id: "number", label: "One number or symbol", test: (pw: string) => /[^A-Za-z]/.test(pw) },
] as const;

export function passwordMeetsRules(pw: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(pw));
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: "" | "Weak" | "Fair" | "Good" | "Strong" };

/**
 * A simple strength score for the "Password strength" bar: one point per
 * rule met, one more for length 12+ with a lowercase letter too.
 */
export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "" };
  let score = PASSWORD_RULES.filter((rule) => rule.test(pw)).length;
  if (pw.length >= 12 && /[a-z]/.test(pw) && score === 3) score += 1;
  const clamped = Math.max(1, Math.min(4, score)) as 1 | 2 | 3 | 4;
  const labels = { 1: "Weak", 2: "Fair", 3: "Good", 4: "Strong" } as const;
  return { score: clamped, label: labels[clamped] };
}
