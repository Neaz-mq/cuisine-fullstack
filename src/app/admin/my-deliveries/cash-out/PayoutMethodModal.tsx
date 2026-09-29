"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { FIELD, LABEL, ModalError, ModalShell, OUTLINE_BUTTON, PRIMARY_BUTTON, RequiredMark } from "@/components/admin/modal-ui";
import { METHOD_LABEL, WALLET_PROVIDERS, type PayoutMethodKind } from "@/lib/payout-methods";

export type SavedMethod =
  | { kind: "BANK"; bank: { bankName: string; accountName: string; summary: string } }
  | { kind: "WALLET"; wallet: { provider: string; summary: string } };

/**
 * Cash Out → Payout Method → "Set up" / "Edit": the rider's bank account or
 * mobile wallet, saved with PATCH /api/rider/payout-method.
 *
 * The account number is never pre-filled — the page only knows the last
 * four digits — so editing means typing it again (as banking apps do).
 */
export default function PayoutMethodModal({
  kind,
  bank,
  wallet,
  onClose,
  onSaved,
}: {
  /** Which method is being set up; null = closed. */
  kind: PayoutMethodKind | null;
  bank: { bankName: string; accountName: string };
  wallet: { provider: string };
  onClose: () => void;
  onSaved: (saved: SavedMethod) => void;
}) {
  if (kind === null) return null;
  // Keyed by kind so each open starts from the saved values.
  return <MethodForm key={kind} kind={kind} bank={bank} wallet={wallet} onClose={onClose} onSaved={onSaved} />;
}

function MethodForm({
  kind,
  bank,
  wallet,
  onClose,
  onSaved,
}: {
  kind: PayoutMethodKind;
  bank: { bankName: string; accountName: string };
  wallet: { provider: string };
  onClose: () => void;
  onSaved: (saved: SavedMethod) => void;
}) {
  const [bankName, setBankName] = useState(bank.bankName);
  const [accountName, setAccountName] = useState(bank.accountName);
  const [accountNumber, setAccountNumber] = useState("");
  const [provider, setProvider] = useState<string>(
    (WALLET_PROVIDERS as readonly string[]).includes(wallet.provider) ? wallet.provider : WALLET_PROVIDERS[0]
  );
  const [walletNumber, setWalletNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body =
        kind === "BANK"
          ? { kind, bankName, accountName, accountNumber }
          : { kind, provider, number: walletNumber };
      const response = await fetch("/api/rider/payout-method", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Couldn't save. Please try again.");
        return;
      }
      onSaved(kind === "BANK" ? { kind, bank: data.bank } : { kind, wallet: data.wallet });
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const titleId = `payout-method-${kind.toLowerCase()}`;
  return (
    <ModalShell
      open
      onClose={onClose}
      title={METHOD_LABEL[kind]}
      titleId={titleId}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className={OUTLINE_BUTTON}>
            Cancel
          </button>
          <button type="submit" form={`${titleId}-form`} disabled={saving} className={PRIMARY_BUTTON}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Save
          </button>
        </div>
      }
    >
      <form id={`${titleId}-form`} onSubmit={save} className="flex flex-col gap-4" noValidate>
        {kind === "BANK" ? (
          <>
            <label className="block">
              <span className={LABEL}>
                Bank Name
                <RequiredMark />
              </span>
              <input
                className={FIELD}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. Dutch-Bangla Bank"
                maxLength={80}
                required
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className={LABEL}>
                Account Holder Name
                <RequiredMark />
              </span>
              <input
                className={FIELD}
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Name exactly as on the account"
                maxLength={80}
                required
                autoComplete="name"
              />
            </label>
            <label className="block">
              <span className={LABEL}>
                Account Number
                <RequiredMark />
              </span>
              <input
                className={FIELD}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="6–20 digits"
                inputMode="numeric"
                maxLength={30}
                required
                autoComplete="off"
              />
            </label>
          </>
        ) : (
          <>
            <fieldset className="block">
              <legend className={LABEL}>
                Wallet
                <RequiredMark />
              </legend>
              <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-4">
                {WALLET_PROVIDERS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={provider === name}
                    onClick={() => setProvider(name)}
                    className={`h-[43px] rounded-[12px] font-sora text-[13px] transition-colors focus:outline-none focus-visible:[outline:2px_solid_#FF9540] ${
                      provider === name
                        ? "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] font-semibold text-white"
                        : "bg-[#F9F6F3] text-black/70 hover:bg-black/[0.05]"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className={LABEL}>
                Wallet Number
                <RequiredMark />
              </span>
              <input
                className={FIELD}
                value={walletNumber}
                onChange={(e) => setWalletNumber(e.target.value)}
                placeholder="01XXXXXXXXX"
                inputMode="tel"
                maxLength={16}
                required
                autoComplete="tel"
              />
            </label>
          </>
        )}

        <p className="flex items-start gap-2 rounded-[12px] bg-[#F9F6F3] p-3 font-sora text-[12px] leading-[1.6] text-black/70">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0ECF00]" strokeWidth={1.8} aria-hidden="true" />
          Only the restaurant owner sees the full number, to send your money. On screen it shows as •••• and the last four
          digits.
        </p>

        {error && <ModalError message={error} />}
      </form>
    </ModalShell>
  );
}
