"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import { GRADIENT } from "./ui";

/**
 * Change Password → the second card (Figma):
 *
 *   Account Security            — "Last password change: 3 months ago"
 *   Two-Factor Authentication   — switch
 *
 * Two-step sign-in here = after the right password, a 6-digit code is
 * emailed and must be typed in (auth.ts, lib/login-code.ts).
 *
 *   Turning it ON  → we email a code; it's switched on only after the code
 *                    is typed back, so we know the emails arrive.
 *   Turning it OFF → asks for the password, so an unlocked phone alone
 *                    can't switch it off.
 */

const BUTTON =
  "inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-full px-5 font-sora text-[15px] font-semibold leading-[1.3] transition focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 md:text-[16px]";
const INPUT =
  "h-[43px] w-full rounded-[12px] bg-[#F9F6F3] px-3 font-sora text-[14px] leading-[1.6] text-black placeholder:text-black/50 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]";

function Row({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] bg-[#F9F6F3] px-4 py-4 md:px-[30px] md:py-5">
      <div className="flex min-w-0 flex-col gap-2.5">
        <p className="font-frank-ruhl text-[20px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[24px]">
          {title}
        </p>
        <div className="font-sora text-[13px] leading-[1.3] tracking-[-0.01em] text-black/70 md:text-[16px]">{children}</div>
      </div>
      {action}
    </div>
  );
}

export default function SecurityCard({
  lastChangeLabel,
  twoFactorEnabled,
  hasPassword,
  email,
}: {
  /** "3 months ago", "Never changed", "No password yet". */
  lastChangeLabel: string;
  twoFactorEnabled: boolean;
  hasPassword: boolean;
  email: string;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(twoFactorEnabled);
  const [dialog, setDialog] = useState<null | "enable" | "disable">(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "send" | "save">(null);
  const [error, setError] = useState<string | null>(null);

  const closeDialog = () => {
    if (busy) return;
    setDialog(null);
    setCode("");
    setPassword("");
    setError(null);
  };

  useEffect(() => {
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setDialog(null);
        setCode("");
        setPassword("");
        setError(null);
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [dialog, busy]);

  const sendCode = async (openDialog: boolean) => {
    setBusy("send");
    setError(null);
    try {
      const res = await fetch("/api/account/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (openDialog) toast.error(data?.error ?? "Couldn't send the code.");
        else setError(data?.error ?? "Couldn't send the code.");
        return;
      }
      if (openDialog) setDialog("enable");
      else toast.success("A new code is on its way");
    } catch {
      toast.error("No connection. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("save");
    setError(null);
    try {
      const res =
        dialog === "enable"
          ? await fetch("/api/account/two-factor", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "confirm", code: code.trim() }),
            })
          : await fetch("/api/account/two-factor", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password }),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      const on = dialog === "enable";
      setEnabled(on);
      toast.success(on ? "Two-step sign-in is on" : "Two-step sign-in is off");
      setDialog(null);
      setCode("");
      setPassword("");
      router.refresh();
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Account security" className="flex flex-col gap-4 rounded-[24px] bg-white p-5 md:rounded-[30px] md:p-[30px]">
      <Row title="Account Security">
        Last password change: <strong className="font-semibold text-black">{lastChangeLabel}</strong>
      </Row>

      <Row
        title="Two-Factor Authentication"
        action={
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Two-factor authentication"
            disabled={!hasPassword || busy !== null}
            onClick={() => (enabled ? setDialog("disable") : sendCode(true))}
            className={`relative h-[42px] w-[72px] shrink-0 rounded-full transition-colors focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-60 ${
              enabled ? "bg-[#FF9540]" : "bg-[rgba(255,149,64,0.4)]"
            }`}
          >
            {busy === "send" && !dialog ? (
              <Loader2 className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" aria-hidden="true" />
            ) : (
              <span
                aria-hidden="true"
                className={`absolute top-[6px] h-[30px] w-[30px] rounded-full bg-white shadow-sm transition-[left] duration-200 ${
                  enabled ? "left-[36px]" : "left-[6px]"
                }`}
              />
            )}
          </button>
        }
      >
        {hasPassword
          ? enabled
            ? "On — we email you a code each time you sign in with your password."
            : "Add an extra layer of security to your account"
          : "Add a password above to use this — Google sign-in is protected by Google."}
      </Row>

      {dialog && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="two-factor-title"
        >
          <form
            onSubmit={confirm}
            noValidate
            className="flex w-full max-w-[480px] flex-col gap-5 rounded-[24px] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] md:rounded-[30px] md:p-[30px]"
          >
            <div className="flex items-start justify-between gap-4">
              <h2
                id="two-factor-title"
                className="font-frank-ruhl text-[24px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[28px]"
              >
                {dialog === "enable" ? "Turn On Two-Step Sign-In" : "Turn Off Two-Step Sign-In"}
              </h2>
              <button
                type="button"
                onClick={closeDialog}
                disabled={busy !== null}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-50"
              >
                <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            {dialog === "enable" ? (
              <div className="flex flex-col gap-2">
                <p className="font-sora text-[14px] leading-[1.6] text-black/70">
                  We sent a 6-digit code to <strong className="font-semibold text-black">{email}</strong>. Enter it here to
                  finish.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, ""));
                    setError(null);
                  }}
                  placeholder="000000"
                  aria-label="6-digit code"
                  className={`${INPUT} text-center font-semibold tracking-[0.5em]`}
                />
                <button
                  type="button"
                  onClick={() => sendCode(false)}
                  disabled={busy !== null}
                  className="self-start font-sora text-[13px] font-semibold text-[#FF7100] hover:underline disabled:opacity-50"
                >
                  {busy === "send" ? "Sending…" : "Send a new code"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="font-sora text-[14px] leading-[1.6] text-black/70">
                  Enter your password to turn it off. You&apos;ll sign in with just your password again.
                </p>
                <input
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  placeholder="Password"
                  aria-label="Password"
                  className={INPUT}
                />
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-[12px] bg-[#FAE7EC] px-4 py-3 font-sora text-[12px] text-[#D72A37]">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeDialog}
                disabled={busy !== null}
                className={`${BUTTON} border border-black text-black hover:bg-black hover:text-white`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy !== null || (dialog === "enable" ? code.length !== 6 : !password)}
                className={`${BUTTON} ${GRADIENT} text-white hover:opacity-90`}
              >
                {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {dialog === "enable" ? "Turn On" : "Turn Off"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
