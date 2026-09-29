/**
 * src/lib/payout-methods.ts
 *
 * Where a rider's cash-out goes — plain helpers with no database access,
 * so the Cash Out page (a client component) and the API share them.
 */

export type PayoutMethodKind = "BANK" | "WALLET";

export const WALLET_PROVIDERS = ["bKash", "Nagad", "Rocket", "Upay"] as const;
export type WalletProvider = (typeof WALLET_PROVIDERS)[number];

export type PayoutAccounts = {
  preferred: PayoutMethodKind | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  walletProvider: string | null;
  walletNumber: string | null;
};

/** "••••4821" — only the last four digits are ever shown on screen. */
export function maskNumber(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\s+/g, "");
  if (!digits) return "";
  return `•••• ${digits.slice(-4)}`;
}

export function bankIsSetUp(accounts: PayoutAccounts): boolean {
  return Boolean(accounts.bankName && accounts.bankAccountNumber && accounts.bankAccountName);
}

export function walletIsSetUp(accounts: PayoutAccounts): boolean {
  return Boolean(accounts.walletProvider && accounts.walletNumber);
}

/** "Standard Chartered •••• 4821" / "bKash •••• 5412" — the line under
 *  each method, and the snapshot saved on a payout request. */
export function destinationLabel(kind: PayoutMethodKind, accounts: PayoutAccounts): string {
  if (kind === "BANK") {
    return bankIsSetUp(accounts) ? `${accounts.bankName} ${maskNumber(accounts.bankAccountNumber)}` : "Not connected";
  }
  return walletIsSetUp(accounts) ? `${accounts.walletProvider} ${maskNumber(accounts.walletNumber)}` : "Not connected";
}

export const METHOD_LABEL: Record<PayoutMethodKind, string> = {
  BANK: "Bank Transfer",
  WALLET: "Mobile Wallet",
};

/** How long the money usually takes once the restaurant pays it. */
export const ARRIVAL_NOTE: Record<PayoutMethodKind, string> = {
  BANK: "Bank transfers usually arrive within 1–2 business days after the restaurant approves them.",
  WALLET: "Mobile wallet payouts usually arrive the same day the restaurant approves them.",
};

/** The full details the owner needs to actually send the money — saved on
 *  the payout request for Admin → Rider Payouts, never sent back to the
 *  rider's browser. */
export function payToDetails(kind: PayoutMethodKind, accounts: PayoutAccounts): string {
  if (kind === "BANK") {
    return `${accounts.bankName ?? ""} · ${accounts.bankAccountName ?? ""} · A/C ${accounts.bankAccountNumber ?? ""}`;
  }
  return `${accounts.walletProvider ?? ""} · ${accounts.walletNumber ?? ""}`;
}

/** Earnings page → "All Statuses ⌄" (the Payout History list). */
export const PAYOUT_STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "PAID", label: "Paid" },
  { value: "PENDING", label: "Pending" },
  { value: "REJECTED", label: "Rejected" },
] as const;
export type PayoutStatusFilter = (typeof PAYOUT_STATUS_OPTIONS)[number]["value"];

export function isPayoutStatusFilter(value: unknown): value is PayoutStatusFilter {
  return PAYOUT_STATUS_OPTIONS.some((option) => option.value === value);
}

export function methodLabel(method: string): string {
  return method === "BANK" || method === "WALLET" ? METHOD_LABEL[method] : method;
}

/** "•••• 4821 · Standard Chartered" — the grey line under each method on
 *  the Cash Out page (Figma order: number first, then the bank). */
export function methodSummary(kind: PayoutMethodKind, accounts: PayoutAccounts): string {
  if (kind === "BANK") {
    return bankIsSetUp(accounts) ? `${maskNumber(accounts.bankAccountNumber)} · ${accounts.bankName}` : "Not connected";
  }
  return walletIsSetUp(accounts) ? `${maskNumber(accounts.walletNumber)} · ${accounts.walletProvider}` : "Not connected";
}
