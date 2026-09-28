"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { PASSWORD_RULES, passwordMeetsRules, passwordStrength } from "@/lib/password-rules";
import { CARD, CARD_TITLE, GRADIENT } from "./ui";

/**
 * Change Password (Figma "Change Password" card).
 *
 *   title + "Update your password to keep your account secure."
 *   Current Password · New Password (+ "Password strength") · Confirm
 *   — each with its own eye button
 *   cream checklist: 8+ characters · uppercase · number or symbol — the
 *   ticks turn orange as each is met
 *   Update Password (gradient) + Cancel (clears the form)
 *
 * Google account without a password → the Current Password box is hidden
 * and the button says "Add Password" (then email + password sign-in works
 * too). Used by the customer panel and by /admin/profile (tone "white").
 */

const LABEL = "mb-1.5 block font-frank-ruhl text-[14px] font-medium leading-[1.6] text-black";
const INPUT =
  "h-[43px] w-full rounded-[12px] bg-[#F9F6F3] pl-3 pr-10 font-sora text-[13px] leading-[1.6] text-black placeholder:text-black/60 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] md:text-[12px]";

const STRENGTH_COLOR = ["bg-black/10", "bg-[#D72A37]", "bg-[#FF9540]", "bg-[#B98900]", "bg-[#0ECF00]"];

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          maxLength={200}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Password"
          className={INPUT}
        />
        <button
          type="button"
          onClick={() => setShow((prev) => !prev)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-black/70 hover:text-black focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
        >
          {show ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export default function PasswordForm({
  hasPassword: initiallyHasPassword,
  tone = "cream",
}: {
  hasPassword: boolean;
  /**
   * "cream" — customer panel (Figma white card, radius 30).
   * "white" — admin panel (its smaller white card).
   */
  tone?: "cream" | "white";
}) {
  const router = useRouter();
  const cardClass =
    tone === "white"
      ? "flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-6"
      : `${CARD} flex flex-col gap-8 md:gap-10`;
  const [hasPassword, setHasPassword] = useState(initiallyHasPassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = passwordStrength(next);
  const mismatch = confirm.length > 0 && next !== confirm;
  const dirty = Boolean(current || next || confirm);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (hasPassword && !current) return setError("Please enter your current password.");
    if (!passwordMeetsRules(next)) return setError("The new password doesn't meet all the rules below yet.");
    if (next !== confirm) return setError("The two new passwords don't match.");

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: hasPassword ? current : undefined, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't change your password.");
        return;
      }
      toast.success(hasPassword ? "Password updated" : "Password added — you can now also sign in with email");
      setHasPassword(true);
      reset();
      router.refresh();
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className={cardClass} noValidate aria-labelledby="change-password-title">
      <div className="flex flex-col gap-3 md:gap-4">
        <h2 id="change-password-title" className={CARD_TITLE}>
          {hasPassword ? "Change Password" : "Add a Password"}
        </h2>
        <p className="font-sora text-[14px] leading-[1.3] tracking-[-0.01em] text-black/70 md:text-[18px] md:leading-[1.14]">
          {hasPassword
            ? "Update your password to keep your account secure."
            : "You sign in with Google. Add a password to also sign in with your email."}
        </p>
      </div>

      <div className="flex flex-col gap-[30px]">
        <div className="flex flex-col gap-5">
          {hasPassword && (
            <PasswordField
              id="current-password"
              label="Current Password"
              value={current}
              onChange={(value) => {
                setCurrent(value);
                setError(null);
              }}
              autoComplete="current-password"
            />
          )}

          <div className="flex flex-col gap-4">
            <PasswordField
              id="new-password"
              label="New Password"
              value={next}
              onChange={(value) => {
                setNext(value);
                setError(null);
              }}
              autoComplete="new-password"
            />
            {/* Figma: "Password strength" on the right, under the box */}
            <div className="flex items-center justify-end gap-3" aria-live="polite">
              {strength.score > 0 && (
                <span className="flex gap-1" aria-hidden="true">
                  {[1, 2, 3, 4].map((step) => (
                    <span
                      key={step}
                      className={`h-1.5 w-6 rounded-full ${step <= strength.score ? STRENGTH_COLOR[strength.score] : "bg-black/10"}`}
                    />
                  ))}
                </span>
              )}
              <span className="font-sora text-[14px] font-semibold leading-[1.6] text-black">
                Password strength{strength.label ? `: ${strength.label}` : ""}
              </span>
            </div>
          </div>

          <div>
            <PasswordField
              id="confirm-password"
              label="Confirm New Password"
              value={confirm}
              onChange={(value) => {
                setConfirm(value);
                setError(null);
              }}
              autoComplete="new-password"
            />
            {mismatch && <p className="mt-1.5 font-sora text-[12px] text-[#D72A37]">The two passwords don&apos;t match yet.</p>}
          </div>
        </div>

        {/* Figma: cream checklist, ticks turn orange when met */}
        <ul className="flex flex-col gap-2 rounded-[20px] bg-[#F9F6F3] p-5" aria-label="Password rules">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(next);
            return (
              <li key={rule.id} className="flex items-center gap-1.5">
                {met ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 fill-[#FF9540] text-white" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-black/25" strokeWidth={1.5} aria-hidden="true" />
                )}
                <span className={`font-sora text-[14px] leading-[1.6] ${met ? "text-black/70" : "text-black/50"}`}>
                  {rule.label}
                  <span className="sr-only">{met ? " — done" : " — not yet"}</span>
                </span>
              </li>
            );
          })}
        </ul>

        {error && (
          <p role="alert" className="rounded-[12px] bg-[#FAE7EC] px-4 py-3 font-sora text-[12px] text-[#D72A37]">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-start gap-2">
          <button
            type="submit"
            disabled={saving}
            className={`inline-flex h-[46px] items-center justify-center gap-2 rounded-full ${GRADIENT} px-5 font-sora text-[15px] font-semibold leading-[1.3] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 md:text-[16px]`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? "Saving…" : hasPassword ? "Update Password" : "Add Password"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={saving || !dirty}
            className="inline-flex h-[46px] items-center justify-center rounded-[90px] border border-black px-5 font-sora text-[15px] font-semibold leading-[1.3] text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-black md:text-[16px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
