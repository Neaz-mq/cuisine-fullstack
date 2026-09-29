"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CircleCheck, CircleDollarSign, Clock3, Loader2, Search, ShoppingBag } from "lucide-react";
import { toast } from "react-toastify";
import FilterMenu from "@/components/admin/FilterMenu";
import { formatAmount } from "@/lib/currency-format";
import { formatOrderId } from "@/lib/format-order-id";
import { periodStart, type DashboardPeriod } from "@/lib/dashboard-period";
import type { AvailableOrderPreview } from "@/lib/rider-panel";

/**
 * Rider panel → Available Orders (Figma "Available Orders"):
 *
 *   search · payment filter
 *   Overview [Today ⌄]      Available Now · Avg. Payout · Avg. Distance
 *   Available Orders [Today ⌄]
 *     3-column cards: #ORD · +$7.20 earning · Cuisine — Main Kitchen
 *                     ● Pickup … ● Drop-off … · 1.2 km
 *                     [1 item] [Ready now] [Cash on Delivery]
 *                     [Cancel] [Accept Delivery]
 *   Showing 1–6 of N Orders            ‹ 1 2 3 … 6 ›
 *
 * The list refreshes itself every 15 seconds, so an order another rider
 * took disappears on its own.
 *
 * "Cancel" only hides the order from THIS rider's list (it stays open for
 * everyone else) — remembered in this browser, and "Show hidden" brings
 * them back. It never cancels the customer's order.
 */

const POLL_INTERVAL_MS = 15000;
const PER_PAGE = 6;
const HIDDEN_KEY = "cuisine.rider.hiddenOrders";
const HIDDEN_EVENT = "cuisine-hidden-orders";

type Feed = { orders: AvailableOrderPreview[]; activeCount: number; maxActive: number };
type Payment = "ALL" | "COD" | "ONLINE";

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
] as const satisfies readonly { value: DashboardPeriod; label: string }[];

const PAYMENT_OPTIONS = [
  { value: "ALL", label: "All Payments" },
  { value: "COD", label: "Cash on Delivery" },
  { value: "ONLINE", label: "Paid Online" },
] as const satisfies readonly { value: Payment; label: string }[];

// --- hidden orders, kept in this browser (localStorage) -----------------
// Read through useSyncExternalStore so the server render (nothing hidden)
// and the first browser render agree, then the saved list applies.
function subscribeHidden(onChange: () => void) {
  window.addEventListener(HIDDEN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(HIDDEN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
function readHidden(): string {
  try {
    return window.localStorage.getItem(HIDDEN_KEY) ?? "";
  } catch {
    return "";
  }
}
function writeHidden(ids: string[]) {
  try {
    window.localStorage.setItem(HIDDEN_KEY, ids.join(","));
  } catch {
    // private mode / storage blocked — hiding just won't be remembered
  }
  window.dispatchEvent(new Event(HIDDEN_EVENT));
}

const noopSubscribe = () => () => {};

function waitingLabel(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "Ready now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function AvailableOrders({
  initial,
  pickupLabel,
  kitchenLabel,
}: {
  initial: Feed;
  /** "Cuisine Kitchen, Jaleshwaritola, Bogura" */
  pickupLabel: string;
  /** "Cuisine — Main Kitchen" */
  kitchenLabel: string;
}) {
  const router = useRouter();
  const [feed, setFeed] = useState<Feed>(initial);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState<Payment>("ALL");
  const [overviewPeriod, setOverviewPeriod] = useState<DashboardPeriod>("today");
  const [listPeriod, setListPeriod] = useState<DashboardPeriod>("today");
  const [page, setPage] = useState(1);
  const [showHidden, setShowHidden] = useState(false);

  // "5 min ago" and the Today filter need the browser's clock.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const hiddenRaw = useSyncExternalStore(subscribeHidden, readHidden, () => "");
  const hiddenIds = useMemo(() => new Set(hiddenRaw.split(",").filter(Boolean)), [hiddenRaw]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/rider/available");
      if (res.ok) setFeed(await res.json());
    } catch {
      // next poll retries
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const atLimit = feed.activeCount >= feed.maxActive;
  const inPeriod = (order: AvailableOrderPreview, period: DashboardPeriod) => {
    if (!isClient) return true;
    const start = periodStart(period);
    return !start || new Date(order.since) >= start;
  };

  // --- overview (all open orders in the overview period) ---
  const overviewOrders = feed.orders.filter((order) => inPeriod(order, overviewPeriod));
  const currency = feed.orders[0]?.currency ?? "USD";
  const avgPayout = overviewOrders.length
    ? overviewOrders.reduce((sum, order) => sum + order.earning, 0) / overviewOrders.length
    : null;
  const withDistance = overviewOrders.filter((order) => order.distanceKm !== null);
  const avgDistance = withDistance.length
    ? withDistance.reduce((sum, order) => sum + (order.distanceKm ?? 0), 0) / withDistance.length
    : null;

  // --- the list ---
  const needle = query.trim().toLowerCase().replace(/^#?\s*ord-?/, "");
  const matching = feed.orders.filter((order) => {
    if (payment !== "ALL" && order.paymentMethod !== payment) return false;
    if (!needle) return true;
    return `${formatOrderId(order.orderId)} ${order.customerName} ${order.area} ${order.itemsSummary}`
      .toLowerCase()
      .includes(needle);
  });
  const hiddenCount = matching.filter((order) => hiddenIds.has(order.orderId)).length;
  const visible = matching.filter((order) => showHidden || !hiddenIds.has(order.orderId));
  const listed = visible.filter((order) => inPeriod(order, listPeriod));
  const olderCount = visible.length - listed.length;

  const totalPages = Math.max(1, Math.ceil(listed.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageOrders = listed.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const first = listed.length === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1;
  const last = Math.min(currentPage * PER_PAGE, listed.length);

  async function accept(order: AvailableOrderPreview) {
    setAcceptingId(order.orderId);
    try {
      const res = await fetch(`/api/rider/available/${order.orderId}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't take this order.");
        await load();
        return;
      }
      toast.success(`${formatOrderId(order.orderId)} is yours — pick it up at the restaurant`);
      router.push("/admin/my-deliveries/active");
      router.refresh();
    } catch {
      toast.error("No connection. Please try again.");
    } finally {
      setAcceptingId(null);
    }
  }

  function hide(order: AvailableOrderPreview) {
    writeHidden([...hiddenIds, order.orderId]);
    toast.info(`${formatOrderId(order.orderId)} hidden from your list — it stays open for other riders.`);
  }

  function unhide(order: AvailableOrderPreview) {
    writeHidden([...hiddenIds].filter((id) => id !== order.orderId));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* --- search + payment filter --- */}
      <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:gap-6">
        <div className="relative h-[50px] min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search by order ID, customer or area..."
            aria-label="Search available orders"
            className="h-[50px] w-full text-ellipsis rounded-full bg-white pl-11 pr-4 font-sora text-[16px] leading-none text-black/80 placeholder:text-[13px] placeholder:text-black/70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] min-[480px]:placeholder:text-[16px]"
          />
        </div>
        <FilterMenu
          surface="white"
          value={payment}
          options={PAYMENT_OPTIONS}
          onSelect={(next) => {
            setPayment(next);
            setPage(1);
          }}
          ariaLabel="Filter by payment"
        />
      </div>

      {atLimit && (
        <p className="rounded-[16px] border border-[#FFD9B8] bg-[#FFF7EF] p-4 font-sora text-[13px] leading-[1.6] text-[#8A4300]">
          You already hold {feed.maxActive} deliveries. Finish one on{" "}
          <Link href="/admin/my-deliveries/active" className="font-semibold underline">
            Active Delivery
          </Link>{" "}
          before taking another.
        </p>
      )}

      {/* --- Overview --- */}
      <section className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">Overview</h2>
          <FilterMenu value={overviewPeriod} options={PERIOD_OPTIONS} onSelect={setOverviewPeriod} ariaLabel="Overview period" />
        </div>
        <div className="grid gap-5 min-[640px]:grid-cols-3">
          <OverviewCard
            label="Available Now"
            value={String(overviewOrders.length)}
            hint={feed.activeCount > 0 ? `Ready for pickup · you hold ${feed.activeCount} of ${feed.maxActive}` : "Ready for pickup"}
            icon={<CircleDollarSign className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />}
          />
          <OverviewCard
            label="Avg. Payout"
            value={avgPayout === null ? "—" : formatAmount(avgPayout, currency)}
            hint="Per delivery · fee + tip"
            icon={<CircleCheck className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />}
          />
          <OverviewCard
            label="Avg. Distance"
            value={avgDistance === null ? "—" : `${avgDistance.toFixed(1)} km`}
            hint="To drop-off"
            icon={<Clock3 className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />}
          />
        </div>
      </section>

      {/* --- Available Orders --- */}
      <section className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:rounded-[30px] md:p-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Available Orders
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowHidden((prev) => !prev)}
                className="font-sora text-[13px] font-semibold text-[#FF7100] hover:underline"
              >
                {showHidden ? "Hide them again" : `Show ${hiddenCount} hidden`}
              </button>
            )}
            <FilterMenu
              value={listPeriod}
              options={PERIOD_OPTIONS}
              onSelect={(next) => {
                setListPeriod(next);
                setPage(1);
              }}
              ariaLabel="Orders period"
            />
          </div>
        </div>

        {pageOrders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[20px] bg-[#F9F6F3] p-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
              <ShoppingBag className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <p className="font-sora text-[14px] leading-[1.6] text-black/70">
              {feed.orders.length === 0
                ? "No orders waiting right now. This list updates by itself — keep it open."
                : olderCount > 0
                  ? `No orders from this period — ${olderCount} older ${olderCount === 1 ? "order is" : "orders are"} still waiting.`
                  : "Nothing matches your search or filter."}
            </p>
            {olderCount > 0 && (
              <button
                type="button"
                onClick={() => setListPeriod("all")}
                className="h-10 rounded-full bg-black px-4 font-sora text-[13px] font-semibold text-white hover:opacity-90"
              >
                Show all orders
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 min-[700px]:grid-cols-2 xl:grid-cols-3">
            {pageOrders.map((order) => {
              const busy = acceptingId === order.orderId;
              const isHidden = hiddenIds.has(order.orderId);
              return (
                <article key={order.orderId} className="flex min-w-0 flex-col gap-5 rounded-[20px] bg-[#F9F6F3] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate font-frank-ruhl text-[20px] font-medium leading-[1.2] text-black">
                        {formatOrderId(order.orderId)}
                      </span>
                      <span className="truncate font-sora text-[12px] leading-[1.7] text-black/70">{kitchenLabel}</span>
                    </div>
                    <span className="shrink-0 font-frank-ruhl text-[16px] font-medium leading-none text-black">
                      +{formatAmount(order.earning, order.currency)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* pickup → drop-off, joined by a dashed line (Figma) */}
                    <div className="flex flex-col gap-2.5">
                      <p className="relative flex items-start gap-1.5 font-sora text-[12px] leading-[1.7] text-black">
                        {/* from this dot down to the drop-off dot, however
                            many lines the pickup address takes */}
                        <span aria-hidden="true" className="absolute bottom-[-16px] left-[4px] top-[17px] border-l border-dashed border-[#BDBDBD]" />
                        <span aria-hidden="true" className="mt-[6px] h-[9px] w-[9px] shrink-0 rounded-full bg-[#D9D9D9]" />
                        <span className="min-w-0 break-words">Pickup: {pickupLabel}</span>
                      </p>
                      <p className="flex items-start gap-1.5 font-sora text-[12px] leading-[1.7] text-black">
                        <span aria-hidden="true" className="mt-[6px] h-[9px] w-[9px] shrink-0 rounded-full bg-[#D9D9D9]" />
                        <span className="min-w-0 break-words">
                          Drop-off: {order.area}
                          {order.distanceKm !== null && ` · ${order.distanceKm.toFixed(1)} km`}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 font-sora text-[10px] leading-none text-black">
                      <span className="rounded-full bg-white px-2 py-1.5" title={order.itemsSummary}>
                        {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1.5" suppressHydrationWarning>
                        {isClient ? waitingLabel(order.since) : "Preparing"}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1.5">
                        {order.paymentMethod === "COD"
                          ? `Cash on Delivery · ${formatAmount(order.totalAmount, order.currency)}`
                          : "Paid Online"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => (isHidden ? unhide(order) : hide(order))}
                      disabled={busy}
                      title={isHidden ? "Show this order in your list again" : "Hide this order from your list (other riders still see it)"}
                      className="flex h-11 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full border border-black px-2 font-sora text-[11px] font-semibold leading-none min-[480px]:px-3 min-[480px]:text-[12px] text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:opacity-50"
                    >
                      {isHidden ? "Unhide" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      onClick={() => accept(order)}
                      disabled={busy || acceptingId !== null || atLimit}
                      title={atLimit ? `You already hold ${feed.maxActive} deliveries` : undefined}
                      className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-2 font-sora text-[11px] font-semibold leading-none min-[480px]:px-3 min-[480px]:text-[12px] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                      {busy ? "Taking…" : "Accept Delivery"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* --- footer: count + pages (Figma) --- */}
        {listed.length > 0 && (
          <div className="flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
            <p className="flex items-center gap-2 font-sora text-[12px] text-black/70">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#FF9540]" />
              Showing{" "}
              <strong className="font-semibold text-black">
                {first}–{last}
              </strong>{" "}
              of <strong className="font-semibold text-black">{listed.length}</strong> Orders
            </p>
            {totalPages > 1 && (
              <Pager page={currentPage} totalPages={totalPages} onPage={setPage} />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function OverviewCard({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return (
    <div className="flex min-h-[142px] min-w-0 flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-frank-ruhl text-[18px] font-medium leading-none text-black xl:text-[20px]">
          {label}
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black">{icon}</span>
      </div>
      <div className="flex flex-col gap-3">
        <span className="font-frank-ruhl text-[22px] font-semibold leading-none text-black xl:text-[24px]">{value}</span>
        <span className="font-sora text-[12px] leading-[1.3] text-black/70">{hint}</span>
      </div>
    </div>
  );
}

/** Figma pager: 34px squares, radius 8 — black for the current page. */
function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  const pages: (number | "gap")[] = [];
  for (let n = 1; n <= totalPages; n++) {
    if (n === 1 || n === totalPages || Math.abs(n - page) <= 1) pages.push(n);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }
  const box =
    "flex h-[34px] min-w-[34px] items-center justify-center rounded-[8px] px-2 font-sora text-[12px] leading-none focus:outline-none focus-visible:[outline:2px_solid_#FF9540]";
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className={`${box} bg-[#F9F6F3] text-black disabled:opacity-40`}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      {pages.map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} className={`${box} bg-[#F9F6F3] text-black/70`} aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onPage(entry)}
            aria-current={entry === page ? "page" : undefined}
            className={`${box} ${entry === page ? "bg-black text-white" : "bg-[#F9F6F3] text-black/70 hover:bg-black/[0.06]"}`}
          >
            {entry}
          </button>
        )
      )}
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className={`${box} bg-[#F9F6F3] text-black disabled:opacity-40`}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
