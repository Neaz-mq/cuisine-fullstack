"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Info, Landmark, Loader2, Pencil, Smartphone, Wallet } from "lucide-react";
import { formatAmount } from "@/lib/currency-format";
import { ARRIVAL_NOTE, METHOD_LABEL, type PayoutMethodKind } from "@/lib/payout-methods";
import { ModalError } from "@/components/admin/modal-ui";
import PayoutMethodModal, { type SavedMethod } from "./PayoutMethodModal";
import CashOutSuccessModal from "./CashOutSuccessModal";

type BankState = { setUp: boolean; summary: string; bankName: string; accountName: string };
type WalletState = { setUp: boolean; summary: string; provider: string };

const GRADIENT = "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)]";
const CARD = "flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5";
const CARD_TITLE = "font-frank-ruhl text-[16px] font-medium leading-[1.4] text-black";
const CARD_HINT = "font-sora text-[12px] leading-[1.4] text-black/70";

/** Decorative squares of the balance card (Figma "Group 2147258169"):
 *  1 = white, 0.4 = white/40, 0 = empty. Columns left → right, bottom-up. */
const SQUARES: number[][] = [
  [0.4],
  [1],
  [0.4, 1],
  [1, 0.4],
  [0.4, 0.4, 1],
  [1, 1, 0.4, 1],
  [1, 0.4, 1, 0.4, 1],
];

/**
 * The Cash Out page's form (Figma "Payout"). Sends
 * POST /api/rider/payouts { amount, method } and shows the success modal.
 */
export default function CashOutForm({
  available,
  pending,
  currency,
  minorUnits,
  weekDeliveries,
  preferred,
  bank: initialBank,
  wallet: initialWallet,
}: {
  available: number;
  pending: number;
  currency: string;
  minorUnits: number;
  weekDeliveries: number;
  preferred: PayoutMethodKind | null;
  bank: BankState;
  wallet: WalletState;
}) {
  const router = useRouter();
  const money = (value: number) => formatAmount(value, currency);

  const [hidden, setHidden] = useState(false);
  const [mode, setMode] = useState<"FULL" | "CUSTOM">("FULL");
  const [custom, setCustom] = useState("");
  const [bank, setBank] = useState(initialBank);
  const [wallet, setWallet] = useState(initialWallet);
  const [method, setMethod] = useState<PayoutMethodKind | null>(
    preferred === "BANK" && initialBank.setUp
      ? "BANK"
      : preferred === "WALLET" && initialWallet.setUp
        ? "WALLET"
        : initialBank.setUp
          ? "BANK"
          : initialWallet.setUp
            ? "WALLET"
            : null
  );
  const [editing, setEditing] = useState<PayoutMethodKind | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ amount: string; destination: string; method: PayoutMethodKind } | null>(null);

  const factor = 10 ** minorUnits;
  const parsed = Number.parseFloat(custom.replace(/,/g, ""));
  const amount =
    mode === "FULL" ? available : Number.isFinite(parsed) ? Math.floor(parsed * factor + 1e-6) / factor : 0;

  const problem =
    available <= 0
      ? pending > 0
        ? `${money(pending)} is already waiting for the restaurant's approval. You can cash out again after your next delivery.`
        : "Nothing to cash out yet — your balance grows with every delivery you complete."
      : mode === "CUSTOM" && custom.trim() === ""
        ? "Enter the amount you want to withdraw."
        : amount <= 0
          ? "Enter an amount above zero."
          : amount > available + 1e-9
            ? `You can withdraw up to ${money(available)}.`
            : method === null
              ? "Set up a payout method first — where should the money go?"
              : "";

  const confirm = async () => {
    if (problem || !method) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/rider/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Couldn't send your cash-out request. Please try again.");
        return;
      }
      setSuccess({ amount: money(data.amount ?? amount), destination: data.destination ?? "", method });
      setCustom("");
      setMode("FULL");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onSaved = (saved: SavedMethod) => {
    if (saved.kind === "BANK") setBank((prev) => ({ ...prev, ...saved.bank, setUp: true }));
    else setWallet((prev) => ({ ...prev, ...saved.wallet, setUp: true }));
    setMethod(saved.kind);
    setEditing(null);
    router.refresh();
  };

  return (
    <>
      {/* --- Available to withdraw --- */}
      <section className={`relative isolate overflow-hidden rounded-[20px] p-5 text-white min-[480px]:p-6 md:px-[30px] ${GRADIENT}`}>
        {/* soft leaf shapes in the background */}
        <svg aria-hidden="true" viewBox="0 0 600 200" preserveAspectRatio="none" className="absolute inset-0 -z-10 h-full w-full">
          <path d="M250 -20 C 330 60, 470 60, 470 110 C 470 160, 330 110, 250 -20 Z" fill="white" fillOpacity="0.14" />
          <path d="M300 30 C 360 150, 420 230, 360 260 C 300 230, 260 120, 300 30 Z" fill="white" fillOpacity="0.1" />
        </svg>

        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black">
            <Wallet className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="font-frank-ruhl text-[16px] font-medium leading-none md:text-[18px]">Available to withdraw</span>
        </div>

        <div className="mt-8 flex items-end justify-between gap-4 md:mt-10">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center gap-4">
              <span className="font-frank-ruhl text-[34px] font-semibold leading-none md:text-[46px]" aria-live="polite">
                {hidden ? "••••••" : money(available)}
              </span>
              <button
                type="button"
                onClick={() => setHidden((value) => !value)}
                aria-label={hidden ? "Show balance" : "Hide balance"}
                aria-pressed={hidden}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30 focus:outline-none focus-visible:[outline:2px_solid_white]"
              >
                {hidden ? <EyeOff className="h-5 w-5" strokeWidth={1.5} /> : <Eye className="h-5 w-5" strokeWidth={1.5} />}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="w-max rounded-full bg-white px-2.5 py-1 font-sora text-[12px] leading-[1.3] text-black md:text-[14px]">
                From {weekDeliveries} {weekDeliveries === 1 ? "delivery" : "deliveries"} this week
              </span>
              {pending > 0 && (
                <span className="w-max rounded-full bg-white/20 px-2.5 py-1 font-sora text-[12px] leading-[1.3] text-white md:text-[14px]">
                  {money(pending)} waiting for approval
                </span>
              )}
            </div>
          </div>

          <div aria-hidden="true" className="hidden shrink-0 items-end gap-1 min-[480px]:flex">
            {SQUARES.map((column, x) => (
              <div key={x} className="flex flex-col-reverse gap-1">
                {column.map((alpha, y) => (
                  <span
                    key={y}
                    className={`block h-3.5 w-3.5 rounded-[4px] ${alpha === 1 ? "bg-white" : "bg-white/40"}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Withdrawal Amount --- */}
      <section className={CARD}>
        <div className="flex flex-col gap-1.5">
          <h2 className={CARD_TITLE}>Withdrawal Amount</h2>
          <p className={CARD_HINT}>Cash out everything or choose a specific amount.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 min-[480px]:gap-3" role="radiogroup" aria-label="Withdrawal amount">
          {(["FULL", "CUSTOM"] as const).map((value) => {
            const on = mode === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setMode(value);
                  setError("");
                }}
                className={`h-[46px] whitespace-nowrap rounded-full px-2 font-sora text-[12px] leading-none transition-colors focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] min-[480px]:text-[14px] ${
                  on ? `${GRADIENT} font-semibold text-white` : "bg-[#F9F6F3] text-black/70 hover:bg-black/[0.05]"
                }`}
              >
                {value === "FULL" ? "Full Balance" : "Custom Amount"}
              </button>
            );
          })}
        </div>
        <label className="flex flex-col gap-2">
          <span className={CARD_TITLE.replace("text-[16px]", "text-[14px]")}>Amount to Withdraw</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            readOnly={mode === "FULL"}
            value={mode === "FULL" ? available.toFixed(minorUnits) : custom}
            onChange={(event) => {
              setCustom(event.target.value.replace(/[^\d.,]/g, ""));
              setError("");
            }}
            onFocus={() => {
              // Typing in the box means a custom amount — start from the full one.
              if (mode === "FULL" && available > 0) {
                setMode("CUSTOM");
                setCustom(available.toFixed(minorUnits));
              }
            }}
            placeholder={(0).toFixed(minorUnits)}
            aria-describedby="cash-out-max"
            className="h-[46px] w-full rounded-[12px] border-0 bg-[#F9F6F3] px-3 font-sora text-[14px] text-black placeholder:text-black/50 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] read-only:text-black/70"
          />
          <span id="cash-out-max" className="font-sora text-[12px] leading-none text-black/70">
            Maximum {money(available)}
          </span>
        </label>
      </section>

      {/* --- Payout Method --- */}
      <section className={CARD}>
        <div className="flex flex-col gap-1.5">
          <h2 className={CARD_TITLE}>Payout Method</h2>
          <p className={CARD_HINT}>Where this cash out will be sent.</p>
        </div>
        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Payout method">
          <MethodRow
            kind="BANK"
            icon={<Landmark className="h-5 w-5 min-[480px]:h-6 min-[480px]:w-6" strokeWidth={1.5} aria-hidden="true" />}
            summary={bank.summary}
            setUp={bank.setUp}
            selected={method === "BANK"}
            onSelect={() => setMethod("BANK")}
            onEdit={() => setEditing("BANK")}
          />
          <MethodRow
            kind="WALLET"
            icon={<Smartphone className="h-5 w-5 min-[480px]:h-6 min-[480px]:w-6" strokeWidth={1.5} aria-hidden="true" />}
            summary={wallet.summary}
            setUp={wallet.setUp}
            selected={method === "WALLET"}
            onSelect={() => setMethod("WALLET")}
            onEdit={() => setEditing("WALLET")}
          />
        </div>
      </section>

      {/* --- Summary --- */}
      <section className={CARD}>
        <dl className="flex flex-col gap-4 font-sora text-[14px] text-black/70">
          <div className="flex items-center justify-between gap-3">
            <dt>Withdrawal amount</dt>
            <dd className="font-frank-ruhl text-[14px] font-semibold text-black">{money(Math.max(0, amount))}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>Processing fee</dt>
            <dd className="font-frank-ruhl text-[14px] font-semibold text-black">{money(0)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-black/10 pt-4">
            <dt className="text-[16px]">You&apos;ll receive</dt>
            <dd className="font-frank-ruhl text-[20px] font-semibold text-black">{money(Math.max(0, amount))}</dd>
          </div>
        </dl>

        <p className="flex items-start gap-2 font-sora text-[13px] leading-[1.5] text-black md:text-[14px]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          {method ? ARRIVAL_NOTE[method] : "Pick where the money should go, then confirm."}
        </p>

        {error && <ModalError message={error} />}
        {!error && problem && (
          <p className={`font-sora text-[12px] leading-[1.5] ${available > 0 ? "text-[#C77C00]" : "text-black/60"}`}>{problem}</p>
        )}

        <button
          type="button"
          onClick={confirm}
          disabled={Boolean(problem) || submitting}
          className={`flex h-[46px] w-full items-center justify-center gap-2 rounded-full px-5 font-sora text-[14px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 min-[480px]:text-[16px] ${GRADIENT}`}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Confirm Cash Out
        </button>
      </section>

      <PayoutMethodModal
        kind={editing}
        bank={{ bankName: bank.bankName, accountName: bank.accountName }}
        wallet={{ provider: wallet.provider }}
        onClose={() => setEditing(null)}
        onSaved={onSaved}
      />

      <CashOutSuccessModal
        open={success !== null}
        amount={success?.amount ?? ""}
        destination={success?.destination ?? ""}
        note={success ? ARRIVAL_NOTE[success.method] : ""}
        onClose={() => setSuccess(null)}
      />
    </>
  );
}

function MethodRow({
  kind,
  icon,
  summary,
  setUp,
  selected,
  onSelect,
  onEdit,
}: {
  kind: PayoutMethodKind;
  icon: React.ReactNode;
  summary: string;
  setUp: boolean;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-[12px] p-2.5 min-[480px]:gap-3 transition-colors min-[480px]:p-3 ${
        selected ? "bg-[#FFF3EA] ring-1 ring-[#FF9540]/40" : "bg-[#F9F6F3]"
      }`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={setUp ? onSelect : onEdit}
        className="flex min-w-0 flex-1 items-center gap-2 text-left min-[480px]:gap-3 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#FFE4CC_0%,#FFD6EE_100%)] text-[#FF7100] min-[480px]:h-[52px] min-[480px]:w-[52px]">
          {icon}
        </span>
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate font-frank-ruhl text-[15px] font-medium leading-none text-black min-[480px]:text-[18px]">
            {METHOD_LABEL[kind]}
          </span>
          <span className="truncate font-sora text-[11px] leading-[1.3] text-black/70 min-[480px]:text-[12px]">{summary}</span>
        </span>
      </button>

      <span className="flex shrink-0 items-center gap-1.5 min-[480px]:gap-2">
        <button
          type="button"
          onClick={onEdit}
          aria-label={setUp ? `Edit ${METHOD_LABEL[kind]}` : `Set up ${METHOD_LABEL[kind]}`}
          className={`flex h-8 items-center justify-center rounded-full font-sora text-[12px] leading-none transition-colors focus:outline-none focus-visible:[outline:2px_solid_#FF9540] ${
            setUp
              ? "w-8 bg-white text-black/70 hover:text-black min-[480px]:w-auto min-[480px]:bg-transparent min-[480px]:px-3 min-[480px]:underline-offset-2 min-[480px]:hover:underline"
              : "whitespace-nowrap border border-black px-3 text-black hover:bg-black hover:text-white"
          }`}
        >
          {setUp ? (
            <>
              <Pencil className="h-3.5 w-3.5 min-[480px]:hidden" strokeWidth={1.8} aria-hidden="true" />
              <span className="hidden min-[480px]:inline">Edit</span>
            </>
          ) : (
            "Set up"
          )}
        </button>
        {setUp && (
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 items-center justify-center rounded-full ${
              selected ? "bg-black text-white" : "border border-black/15 bg-white text-black/40"
            }`}
          >
            <Check className="h-4 w-4" strokeWidth={2.2} />
          </span>
        )}
      </span>
    </div>
  );
}
