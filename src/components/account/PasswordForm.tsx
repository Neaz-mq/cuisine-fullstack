"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { CARD, CARD_SUBTITLE, CARD_TITLE, FIELD_INPUT, FIELD_LABEL, OUTLINE_BUTTON } from "./ui";

/**
 * Customer panel → Profile → "Password".
 *
 * Has a password → change it (current one required).
 * Google account without one → can add one, so they can also sign in
 * with email + password (e.g. on a device without their Google account).
 */
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
  // Both panels now put white cards on a cream page, so the inputs are cream
  // either way; the admin card is just a little tighter.
  const cardClass = tone === "white" ? "flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-6" : `${CARD} flex flex-col gap-5`;
  const inputClass = FIELD_INPUT;
  const softBg = "bg-[#F9F6F3]";
  const [hasPassword, setHasPassword] = useState(initiallyHasPassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (hasPassword && !current) return setError("Please enter your current password.");
    if (next.length < 6) return setError("The new password must be at least 6 characters.");
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
      toast.success(hasPassword ? "Password changed" : "Password added — you can now also sign in with email");
      setHasPassword(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const type = show ? "text" : "password";

  return (
    <form onSubmit={submit} className={cardClass} noValidate>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={CARD_TITLE}>{hasPassword ? "Change Password" : "Add a Password"}</h2>
          <p className={CARD_SUBTITLE}>
            {hasPassword
              ? "Use at least 6 characters. You'll stay signed in on this device."
              : "You sign in with Google. Add a password if you'd also like to sign in with your email."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShow((value) => !value)}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${softBg} text-black/60 hover:text-black`}
          aria-label={show ? "Hide passwords" : "Show passwords"}
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-3">
        {hasPassword && (
          <div className="min-w-0">
            <label htmlFor="pw-current" className={FIELD_LABEL}>
              Current password
            </label>
            <input
              id="pw-current"
              type={type}
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={inputClass}
            />
          </div>
        )}
        <div className="min-w-0">
          <label htmlFor="pw-new" className={FIELD_LABEL}>
            New password
          </label>
          <input
            id="pw-new"
            type={type}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="pw-confirm" className={FIELD_LABEL}>
            Confirm new password
          </label>
          <input
            id="pw-confirm"
            type={type}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-[12px] bg-[#FAE7EC] px-4 py-3 font-sora text-[12px] text-[#D72A37]">
          {error}
        </p>
      )}

      <button type="submit" disabled={saving || !next} className={`${OUTLINE_BUTTON} self-start`}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {saving ? "Saving…" : hasPassword ? "Change password" : "Add password"}
      </button>
    </form>
  );
}
