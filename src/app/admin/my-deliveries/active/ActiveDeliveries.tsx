"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, MessageSquareText, Navigation, Phone, Search, ShoppingBag, Undo2 } from "lucide-react";
import { toast } from "react-toastify";
import ChatModal from "@/components/ChatModal";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import FilterMenu from "@/components/admin/FilterMenu";
import { formatOrderId } from "@/lib/format-order-id";
import { distanceKm, etaMinutes } from "@/lib/rider-stats";
import type { ActiveDelivery } from "@/lib/rider-panel";

// Leaflet touches `window` as soon as it loads — browser only. The
// placeholder has the map's size so nothing jumps when it arrives.
const LiveDeliveryMap = dynamic(() => import("@/components/LiveDeliveryMap"), {
  ssr: false,
  loading: () => <div className={`w-full animate-pulse rounded-[20px] bg-black/5 ${MAP_HEIGHT}`} />,
});

const MAP_HEIGHT = "h-[300px] md:h-[380px] xl:h-[441px]";
const POLL_INTERVAL_MS = 15000; // same cadence as KitchenBoard / OrderTrackingTimeline
/** A position older than this is "where they were", not "where they are". */
const LIVE_POSITION_MS = 3 * 60_000;

type LatLng = { lat: number; lng: number };
type StatusFilter = "ALL" | "WAITING" | "ON_THE_WAY";
type Confirm = { kind: "deliver" | "release"; delivery: ActiveDelivery } | null;

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "WAITING", label: "Waiting for pickup" },
  { value: "ON_THE_WAY", label: "On the way" },
] as const satisfies readonly { value: StatusFilter; label: string }[];

const CARD = "flex min-w-0 flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]";
const CARD_TITLE = "font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]";
const PRIMARY =
  "flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[15px] font-semibold leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 md:text-[16px]";

const noopSubscribe = () => () => {};

// "Now", refreshed every 30 s (null on the server) — to tell a fresh rider
// position from an old one without reading the clock during render.
const NOW_STEP_MS = 30_000;
function subscribeNow(onChange: () => void) {
  const id = setInterval(onChange, NOW_STEP_MS);
  return () => clearInterval(id);
}
const readNow = () => Math.floor(Date.now() / NOW_STEP_MS) * NOW_STEP_MS;

function clock(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
}

/**
 * Rider panel → Active Delivery (Figma):
 *
 *   search · status filter          (and a pill per order when there are several)
 *   map: route rider → customer, "Arriving in 25–30 min", "1.2 km remaining"
 *   Delivery Progress: Order Accepted → Picked Up → On the Way → Delivered
 *                      + Picked Up / Mark as Delivered
 *   Order Details: #ORD, dishes, Our Own Delivery, Total
 *   Customer: photo, name, address, phone · Call · Message (chat pop-up)
 *
 * Call: a plain phone link (tel:) with the customer's number on screen —
 * what Foodpanda/Pathao riders use in Bangladesh when the app has no masked
 * calling. The number is only shown for orders the rider holds.
 *
 * Live location is browser-based: it is sent while this tab is open and
 * the screen is on, not in the background. The rider is told so.
 */
export default function ActiveDeliveries({
  initialDeliveries,
  origin,
}: {
  initialDeliveries: ActiveDelivery[];
  /** The restaurant — where the rider picks up. */
  origin: LatLng;
}) {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<ActiveDelivery[]>(initialDeliveries);
  const [selectedId, setSelectedId] = useState<string | null>(initialDeliveries[0]?.orderId ?? null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [geoStatus, setGeoStatus] = useState<"idle" | "active" | "denied" | "unsupported" | "far">("idle");
  const [farKm, setFarKm] = useState<number | null>(null);
  // This device's own position — fresher for the rider's own map than the
  // copy the server keeps.
  const [myPosition, setMyPosition] = useState<LatLng | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [chatReadAt, setChatReadAt] = useState<Record<string, number>>({});
  const activeOrderIdsRef = useRef<string[]>(initialDeliveries.map((d) => d.orderId));
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const loadDeliveries = useCallback(async () => {
    try {
      const res = await fetch("/api/rider/deliveries");
      if (!res.ok) return;
      const data: ActiveDelivery[] = await res.json();
      setDeliveries(data);
      activeOrderIdsRef.current = data.map((d) => d.orderId);
    } catch {
      // network error — the next poll tries again
    }
  }, []);

  // The first list came from the server; this keeps it fresh (a new
  // assignment, the kitchen dispatching, a cancellation).
  useEffect(() => {
    const interval = setInterval(loadDeliveries, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadDeliveries]);

  // One watchPosition for the page, sent to every order the rider holds.
  // Started by the rider's tap — an unprompted request is often blocked.
  const startSharing = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unsupported");
      return;
    }
    navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMyPosition({ lat: latitude, lng: longitude });
        if (activeOrderIdsRef.current.length === 0) setGeoStatus("active");
        activeOrderIdsRef.current.forEach((orderId) => {
          fetch(`/api/rider/deliveries/${orderId}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          })
            .then(async (res) => {
              // The server refuses positions impossibly far from the
              // restaurant (a PC behind a VPN — see the location route).
              if (res.status === 422) {
                const data = await res.json().catch(() => ({}));
                if (data.reason === "too_far") {
                  setFarKm(typeof data.distanceKm === "number" ? data.distanceKm : null);
                  setGeoStatus("far");
                  return;
                }
              }
              if (res.ok) setGeoStatus("active");
            })
            .catch(() => {
              // best-effort — the next position update retries
            });
        });
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }, []);

  async function act(delivery: ActiveDelivery, action: "pickup" | "deliver" | "release") {
    setBusyId(delivery.orderId);
    try {
      const res =
        action === "release"
          ? await fetch(`/api/rider/deliveries/${delivery.orderId}`, { method: "DELETE" })
          : await fetch(`/api/rider/deliveries/${delivery.orderId}/${action}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Something went wrong. Please try again.");
        await loadDeliveries();
        return;
      }
      if (action === "pickup") {
        toast.success("Picked up — the customer can now follow you on the map");
        const now = new Date().toISOString();
        setDeliveries((prev) =>
          prev.map((d) => (d.orderId === delivery.orderId ? { ...d, status: "OUT_FOR_DELIVERY", pickedUpAt: now } : d))
        );
      } else {
        toast.success(action === "deliver" ? "Delivered — nice work!" : "Order released for another rider");
        setDeliveries((prev) => prev.filter((d) => d.orderId !== delivery.orderId));
        activeOrderIdsRef.current = activeOrderIdsRef.current.filter((id) => id !== delivery.orderId);
        setChatOpen(false);
      }
      setConfirm(null);
      router.refresh();
    } catch {
      toast.error("No connection. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  // --- which delivery is on screen ---
  const needle = query.trim().toLowerCase().replace(/^#?\s*ord-?/, "");
  const matching = deliveries.filter((d) => {
    const waiting = d.status !== "OUT_FOR_DELIVERY";
    if (status === "WAITING" && !waiting) return false;
    if (status === "ON_THE_WAY" && waiting) return false;
    if (!needle) return true;
    return `${formatOrderId(d.orderId)} ${d.customerName} ${d.address} ${d.phone}`.toLowerCase().includes(needle);
  });
  const current = matching.find((d) => d.orderId === selectedId) ?? matching[0] ?? null;

  const toolbar = (
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
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by customer name, order ID..."
          aria-label="Search your deliveries"
          className="h-[50px] w-full text-ellipsis rounded-full bg-white pl-11 pr-4 font-sora text-[16px] leading-none text-black/80 placeholder:text-[13px] placeholder:text-black/70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] min-[480px]:placeholder:text-[16px]"
        />
      </div>
      <FilterMenu surface="white" value={status} options={STATUS_OPTIONS} onSelect={setStatus} ariaLabel="Filter by status" />
    </div>
  );

  if (deliveries.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {toolbar}
        <div className="flex flex-col items-center gap-4 rounded-[20px] bg-white p-8 text-center md:p-12">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F9F6F3]">
            <ShoppingBag className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p className="font-sora text-[14px] text-black/70">No active delivery right now.</p>
          <Link
            href="/admin/my-deliveries/available"
            className="flex h-[46px] items-center rounded-full bg-black px-5 font-sora text-[15px] font-semibold text-white hover:opacity-90"
          >
            Find Available Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {toolbar}

      {/* several orders at once → one pill each */}
      {matching.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Your deliveries">
          {matching.map((d) => {
            const selected = d.orderId === current?.orderId;
            return (
              <button
                key={d.orderId}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setSelectedId(d.orderId);
                  setChatOpen(false);
                }}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 font-sora text-[13px] leading-none transition-colors ${
                  selected ? "bg-black text-white" : "bg-white text-black hover:bg-black/[0.04]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${d.status === "OUT_FOR_DELIVERY" ? "bg-[#FF7100]" : "bg-[#C77C00]"}`}
                />
                {formatOrderId(d.orderId)} · {d.customerName.split(" ")[0]}
              </button>
            );
          })}
        </div>
      )}

      <LocationNotice status={geoStatus} farKm={farKm} onStart={startSharing} />

      {!current ? (
        <p className="rounded-[20px] bg-white p-6 text-center font-sora text-[14px] text-black/70">
          None of your deliveries match your search or filter.
        </p>
      ) : (
        <DeliveryView
          delivery={current}
          origin={origin}
          myPosition={myPosition}
          isClient={isClient}
          busy={busyId === current.orderId}
          unread={unread}
          onPickup={() => act(current, "pickup")}
          onDeliver={() => setConfirm({ kind: "deliver", delivery: current })}
          onRelease={() => setConfirm({ kind: "release", delivery: current })}
          onOpenChat={() => setChatOpen(true)}
        />
      )}

      {current && (
        <ChatModal
          key={current.orderId}
          open={chatOpen}
          onClose={() => {
            setChatOpen(false);
            setChatReadAt((prev) => ({ ...prev, [current.orderId]: Date.now() }));
          }}
          orderId={current.orderId}
          riderName={current.customerName}
          title="Chat with Your Customer"
          viewerRole="RIDER"
          chatUrl={`/api/rider/deliveries/${current.orderId}/chat`}
          active
          lastReadAt={chatReadAt[current.orderId] ?? 0}
          onUnreadChange={setUnread}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        tone={confirm?.kind === "deliver" ? "primary" : "danger"}
        title={confirm?.kind === "deliver" ? "Mark as delivered?" : "Release this order?"}
        message={
          confirm?.kind === "deliver"
            ? confirm.delivery.paymentMethod === "COD"
              ? `Hand the food to ${confirm.delivery.customerName} and collect ${confirm.delivery.totalAmount} in cash.`
              : `Hand the food to ${confirm.delivery.customerName}. It's already paid online.`
            : "It goes back to Available Orders so another rider can take it."
        }
        confirmLabel={confirm?.kind === "deliver" ? "Yes, Delivered" : "Release"}
        pending={busyId !== null}
        onConfirm={() => confirm && act(confirm.delivery, confirm.kind)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function DeliveryView({
  delivery: d,
  origin,
  myPosition,
  isClient,
  busy,
  unread,
  onPickup,
  onDeliver,
  onRelease,
  onOpenChat,
}: {
  delivery: ActiveDelivery;
  origin: LatLng;
  myPosition: LatLng | null;
  isClient: boolean;
  busy: boolean;
  unread: number;
  onPickup: () => void;
  onDeliver: () => void;
  onRelease: () => void;
  onOpenChat: () => void;
}) {
  const waiting = d.status !== "OUT_FOR_DELIVERY";
  const destination = d.destLat !== null && d.destLng !== null ? { lat: d.destLat, lng: d.destLng } : null;

  // Where the rider is: this phone's own GPS, else the last position the
  // server has if it's recent. Before pick-up the trip starts at the
  // restaurant.
  const now = useSyncExternalStore(subscribeNow, readNow, () => null);
  const serverPosition =
    now !== null && now - new Date(d.riderUpdatedAt).getTime() < LIVE_POSITION_MS
      ? { lat: d.riderLat, lng: d.riderLng }
      : null;
  const riderPosition = waiting ? null : (myPosition ?? serverPosition);
  const from = riderPosition ?? origin;
  const km = destination ? distanceKm(from, destination) : null;
  const eta = destination ? etaMinutes(from, destination) : null;

  const caption = waiting ? "Pick up at the restaurant" : "Arriving in";
  const headline = waiting
    ? "Waiting for pickup"
    : eta === null
      ? "Follow the address"
      : `${eta}–${eta + 5} min`;
  const remaining = km === null ? undefined : waiting ? `${km.toFixed(1)} km to drop-off` : `${km.toFixed(1)} km remaining`;

  const navigateUrl = `https://www.google.com/maps/dir/?api=1&destination=${
    destination ? `${destination.lat},${destination.lng}` : encodeURIComponent(d.address)
  }&travelmode=driving`;

  const steps = [
    { label: d.selfAssigned ? "Order Accepted" : "Order Assigned to You", at: d.assignedAt, done: true },
    { label: "Picked Up from Kitchen", at: d.pickedUpAt, done: !waiting },
    { label: `On the Way to ${d.area}`, at: d.pickedUpAt, done: !waiting },
    { label: "Delivered", at: null, done: false },
  ];

  return (
    <>
      <LiveDeliveryMap
        origin={origin}
        destination={destination}
        rider={riderPosition}
        riderUpdatedAt={riderPosition && !myPosition ? d.riderUpdatedAt : null}
        caption={caption}
        headline={headline}
        remainingLabel={remaining}
        heightClassName={MAP_HEIGHT}
        topLeftSlot={
          <a
            href={navigateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 items-center gap-2 rounded-full bg-white px-4 font-sora text-[13px] font-semibold text-black shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:bg-[#F9F6F3] md:h-11 md:text-[14px]"
          >
            <Navigation className="h-4 w-4" aria-hidden="true" />
            Navigate
          </a>
        }
      />

      <div className="grid gap-6 min-[900px]:grid-cols-2">
        {/* --- Delivery Progress --- */}
        <section className={CARD} aria-labelledby="delivery-progress">
          <h2 id="delivery-progress" className={CARD_TITLE}>
            Delivery Progress
          </h2>
          <ol className="relative flex flex-col gap-4">
            {/* the grey rail behind the ticks */}
            <span aria-hidden="true" className="absolute bottom-8 left-[27px] top-8 w-[2px] bg-[#D9D9D9]" />
            {steps.map((step) => (
              <li key={step.label} className="relative flex items-center gap-2.5 rounded-[16px] bg-[#F9F6F3] p-4">
                {step.done ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0ECF00]" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                ) : (
                  <span className="h-6 w-6 shrink-0 rounded-full border-2 border-[#D9D9D9] bg-white" aria-hidden="true" />
                )}
                <span className="flex min-w-0 flex-col gap-2">
                  <span className={`font-frank-ruhl text-[16px] font-semibold leading-none ${step.done ? "text-black" : "text-black/45"}`}>
                    {step.label}
                    <span className="sr-only">{step.done ? " — done" : " — not yet"}</span>
                  </span>
                  <span className="font-sora text-[12px] leading-none text-black/70" suppressHydrationWarning>
                    {step.done ? (isClient ? clock(step.at) : "") : "Pending"}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          {waiting ? (
            <div className="flex flex-col gap-3">
              <p className="font-sora text-[12px] leading-[1.6] text-black/60 md:text-[13px]">
                Collect the food at the restaurant, then press <strong className="text-black">Picked Up</strong> — the
                customer is told it&apos;s on the way.
              </p>
              <button type="button" onClick={onPickup} disabled={busy} className={PRIMARY}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Picked Up
              </button>
              {d.selfAssigned && (
                <button
                  type="button"
                  onClick={onRelease}
                  disabled={busy}
                  className="flex items-center justify-center gap-1.5 self-center font-sora text-[13px] font-semibold text-[#D72A37] hover:underline disabled:opacity-50"
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Release this order
                </button>
              )}
            </div>
          ) : (
            <button type="button" onClick={onDeliver} disabled={busy} className={PRIMARY}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Mark as Delivered
            </button>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          {/* --- Order Details --- */}
          <section className={CARD} aria-labelledby="order-details">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="order-details" className={CARD_TITLE}>
                Order Details
              </h2>
              <span className="font-sora text-[14px] leading-none text-black md:text-[16px]">
                {d.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-frank-ruhl text-[20px] font-medium leading-[1.2] text-black">{formatOrderId(d.orderId)}</p>
              <p className="font-sora text-[12px] leading-[1.7] text-black/70">{d.itemsSummary}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-3 font-sora text-[14px] leading-none text-black/70 md:text-[16px]">
                <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-[#FF9540]" />
                Our Own Delivery
              </span>
              <span className="font-frank-ruhl text-[16px] font-medium leading-none text-black/70">
                Total: <span className="text-[20px] font-semibold text-black">{d.totalAmount}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2 font-sora text-[12px] leading-none md:text-[13px]">
              {d.paymentMethod === "COD" ? (
                <span className="rounded-full bg-[#FFF2DA] px-3 py-2 text-[#8A5A00]">Collect {d.totalAmount} in cash</span>
              ) : (
                <span className="rounded-full bg-[#E5EDFF] px-3 py-2 text-[#0063B0]">Already paid — nothing to collect</span>
              )}
              <span className="rounded-full bg-[#F1FEF3] px-3 py-2 text-[#0A8F00]">You earn {d.earning}</span>
            </div>
          </section>

          {/* --- Customer --- */}
          <section className={CARD} aria-labelledby="customer-card">
            <h2 id="customer-card" className={CARD_TITLE}>
              Customer
            </h2>
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-[#F9F6F3]">
                {d.customerImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Google/Supabase avatar, any allowed host
                  <img src={d.customerImage} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden="true" className="font-frank-ruhl text-[24px] font-semibold text-black/70">
                    {d.customerName.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="truncate font-frank-ruhl text-[20px] font-medium leading-[1.2] text-black">{d.customerName}</p>
                <p className="break-words font-sora text-[12px] leading-[1.7] text-black/70">{d.address}</p>
                <a href={`tel:${d.phone}`} className="w-fit font-sora text-[13px] font-semibold text-black hover:underline">
                  {d.phone}
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`tel:${d.phone}`}
                className="flex h-[50px] items-center justify-center gap-2 rounded-full bg-[#E8FFEC] px-3 font-sora text-[15px] font-semibold leading-none text-[#0ECF00] transition-opacity hover:opacity-80 md:text-[16px]"
              >
                <Phone className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                Call
              </a>
              <button
                type="button"
                onClick={onOpenChat}
                aria-label={unread > 0 ? `Message — ${unread} unread` : "Message"}
                className="relative flex h-[50px] items-center justify-center gap-2 rounded-full bg-[#E5EDFF] px-3 font-sora text-[15px] font-semibold leading-none text-[#0090FF] transition-opacity hover:opacity-80 md:text-[16px]"
              >
                <MessageSquareText className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                Message
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D72A37] px-1 font-sora text-[11px] font-semibold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function LocationNotice({
  status,
  farKm,
  onStart,
}: {
  status: "idle" | "active" | "denied" | "unsupported" | "far";
  farKm: number | null;
  onStart: () => void;
}) {
  if (status === "active") {
    return (
      <p className="flex items-center gap-2 rounded-[16px] bg-[#F1FEF3] px-4 py-3 font-sora text-[13px] text-[#0A8F00]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#0ECF00]" aria-hidden="true" />
        Sharing your live location — keep this tab open while delivering.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-[#FFD9B8] bg-[#FFF7EF] p-4 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
      <p className="flex items-start gap-2.5 font-sora text-[13px] leading-[1.6] text-[#8A4300] md:text-[14px]">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF7100]" strokeWidth={1.5} aria-hidden="true" />
        <span>
          {status === "unsupported"
            ? "This browser can't share location. Open this page on your phone to show customers where you are."
            : status === "far"
              ? `Your device says you are ${farKm !== null ? `about ${farKm.toLocaleString("en-US")} km` : "very far"} from the restaurant, so your position is not shown to the customer. Turn a VPN off, or use your phone with location on.`
              : status === "denied"
                ? "Location permission was denied. Allow location for this site in your browser settings, then reload."
                : "Share your live location so the customer can see you on the map."}
        </span>
      </p>
      {status === "idle" && (
        <button
          type="button"
          onClick={onStart}
          className="h-10 shrink-0 self-start rounded-full bg-black px-4 font-sora text-[13px] font-semibold text-white hover:opacity-90 min-[640px]:self-auto"
        >
          Enable location sharing
        </button>
      )}
    </div>
  );
}
