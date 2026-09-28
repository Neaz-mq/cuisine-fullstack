"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { PASSWORD_RULES, passwordStrength } from "@/lib/password-rules";

/**
 * The live password checklist under a "new password" box — sign up, reset
 * password and staff forms. Same rules and wording as Change Password
 * (lib/password-rules.ts), so a password that works in one place works
 * everywhere:
 *
 *   ✓ At least 8 characters   ✓ One uppercase letter   ✓ One number or symbol
 *   Password strength: Good ▬▬▬▬
 *
 * Hidden until the person starts typing (unless `alwaysShow`), so the form
 * stays calm until it matters.
 */

const STRENGTH_COLOR = ["bg-black/10", "bg-[#D72A37]", "bg-[#FF9540]", "bg-[#B98900]", "bg-[#0ECF00]"];

export default function PasswordRulesHint({
  value,
  alwaysShow = false,
  id,
}: {
  value: string;
  alwaysShow?: boolean;
  /** For aria-describedby on the password input. */
  id?: string;
}) {
  if (!value && !alwaysShow) return null;
  const strength = passwordStrength(value);

  return (
    <div id={id} className="mt-2 flex flex-col gap-1.5" aria-live="polite">
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Password rules">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(value);
          return (
            <li key={rule.id} className="flex items-center gap-1">
              {met ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 fill-[#FF9540] text-white" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-black/25" strokeWidth={1.5} aria-hidden="true" />
              )}
              <span className={`font-sora text-[12px] leading-[1.4] ${met ? "text-black/75" : "text-black/50"}`}>
                {rule.label}
                <span className="sr-only">{met ? " — done" : " — not yet"}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {strength.score > 0 && (
        <div className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={`h-1.5 w-5 rounded-full ${step <= strength.score ? STRENGTH_COLOR[strength.score] : "bg-black/10"}`}
              />
            ))}
          </span>
          <span className="font-sora text-[12px] font-semibold text-black">Password strength: {strength.label}</span>
        </div>
      )}
    </div>
  );
}
