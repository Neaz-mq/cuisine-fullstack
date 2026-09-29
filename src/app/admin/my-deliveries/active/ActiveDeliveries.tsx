"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Phone,
  ShoppingBag,
  Undo2,
} from "lucide-react";
import { toast } from "react-toastify";
import ChatPanel from "@/components/ChatPanel";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { formatOrderId } from "@/lib/format-order-id";
import type { ActiveDelivery } from "@/lib/rider-panel";

const POLL_INTERVAL_MS = 15000; // same cadence as KitchenBoard / OrderTrackingTimeline

const BUTTON =
  "flex h-[46px] w-full min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 font-sora text-[14px] font-semibold leading-none transition focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 min-[480px]:w-auto min-[480px]:flex-1 md:text-[15px]";
const OUTLINE = `${BUTTON} border border-black text-black hover:bg-black hover:text-white`;
const PRIMARY = `${BUTTON} bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white hover:opacity-90`;

type Confirm = { kind: "deliver" | "release"; delivery: ActiveDelivery } | null;

/**
 * Rider panel → Active Delivery: every order the rider holds right now.
 *
 *   Waiting for pickup (taken from Available Orders, still in the kitchen)
 *     → Call · Release (give it back) · Picked Up
 *   On the way
 *     → Navigate · Chat · Mark Delivered
 *
 * Live location: browser-based — it only broadcasts while this tab is open
 * and the screen is on. It is NOT a background-GPS app: if the rider locks
 * the phone or closes the tab, updates pause until they come back. The
 * rider is told so below rather than it silently not working.
 */
export default function ActiveDeliveries({ initialDeliveries }: { initialDeliveries: ActiveDelivery[] }) {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<ActiveDelivery[]>(initialDeliveries);
  const [geoStatus, setGeoStatus] = useState<"idle" | "active" | "denied" | "unsupported" | "far">("idle");
  // How far away the device claimed to be, when the server refused it.
  const [farKm, setFarKm] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  // One chat open at a time — several open chat logs at once is too much
  // on a phone.
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const activeOrderIdsRef = useRef<string[]>(initialDeliveries.map((d) => d.orderId));

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

  // The first list came from the server; this only keeps it fresh (a new
  // assignment, the kitchen dispatching, a cancellation).
  useEffect(() => {
    const interval = setInterval(loadDeliveries, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadDeliveries]);

  // One watchPosition for the whole page, sent to every order the rider
  // holds. Started by the rider's own tap — an unprompted location request
  // is usually blocked by the browser anyway.
  const startSharing = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unsupported");
      return;
    }
    navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
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
        setDeliveries((prev) =>
          prev.map((d) => (d.orderId === delivery.orderId ? { ...d, status: "OUT_FOR_DELIVERY" } : d))
        );
      } else {
        toast.success(action === "deliver" ? "Delivered — nice work!" : "Order released for another rider");
        setDeliveries((prev) => prev.filter((d) => d.orderId !== delivery.orderId));
        activeOrderIdsRef.current = activeOrderIdsRef.current.filter((id) => id !== delivery.orderId);
      }
      setConfirm(null);
      router.refresh();
    } catch {
      toast.error("No connection. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  function navigateUrl(d: ActiveDelivery) {
    // No map point → hand Google Maps the written address instead.
    const destination =
      d.destLat !== null && d.destLng !== null ? `${d.destLat},${d.destLng}` : encodeURIComponent(d.address);
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
  }

  return (
    <div className="flex flex-col gap-4">
      <LocationNotice status={geoStatus} farKm={farKm} onStart={startSharing} />

      {deliveries.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[20px] bg-white p-8 text-center">
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
      ) : (
        deliveries.map((d) => {
          const waiting = d.status !== "OUT_FOR_DELIVERY";
          const busy = busyId === d.orderId;
          return (
            <article key={d.orderId} className="flex flex-col gap-4 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-frank-ruhl text-[20px] font-medium leading-none text-black">
                  {formatOrderId(d.orderId)}
                </span>
                <span
                  className={`inline-flex h-8 items-center rounded-full px-3 font-sora text-[12px] leading-none min-[480px]:text-[13px] ${
                    waiting ? "bg-[#FFF2DA] text-[#C77C00]" : "bg-[#FFEDE0] text-[#FF7100]"
                  }`}
                >
                  {waiting ? "Waiting for pickup" : "On the way"}
                </span>
              </div>

              <div className="flex flex-col gap-2 rounded-[16px] bg-[#F9F6F3] p-4">
                <p className="font-sora text-[16px] font-semibold text-black">{d.customerName}</p>
                <p className="flex items-start gap-2 font-sora text-[13px] leading-[1.5] text-black/70 md:text-[14px]">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  {d.address}
                </p>
                <a
                  href={`tel:${d.phone}`}
                  className="flex w-fit items-center gap-2 font-sora text-[13px] text-black/70 hover:text-black md:text-[14px]"
                >
                  <Phone className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  {d.phone}
                </a>
              </div>

              <div className="flex flex-wrap gap-2 font-sora text-[12px] leading-none md:text-[13px]">
                <span className="rounded-full bg-[#F9F6F3] px-3 py-2 text-black">
                  {d.itemCount} {d.itemCount === 1 ? "item" : "items"}
                </span>
                <span
                  className={`rounded-full px-3 py-2 ${
                    d.paymentMethod === "COD" ? "bg-[#FFF2DA] text-[#8A5A00]" : "bg-[#E5EDFF] text-[#0063B0]"
                  }`}
                >
                  {d.paymentMethod === "COD" ? `Collect cash ${d.totalAmount}` : `Paid online · ${d.totalAmount}`}
                </span>
                <span className="rounded-full bg-[#F1FEF3] px-3 py-2 text-[#0A8F00]">You earn {d.earning}</span>
              </div>

              {waiting && (
                <p className="font-sora text-[12px] leading-[1.6] text-black/60 md:text-[13px]">
                  The kitchen is preparing this order. Collect it at the restaurant, then press{" "}
                  <strong className="font-semibold text-black">Picked Up</strong> — the customer is told it&apos;s on
                  the way.
                </p>
              )}

              <div className="flex flex-col gap-2 min-[480px]:flex-row">
                {waiting ? (
                  <>
                    <a href={`tel:${d.phone}`} className={OUTLINE}>
                      <Phone className="h-4 w-4" aria-hidden="true" />
                      Call
                    </a>
                    {d.selfAssigned && (
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "release", delivery: d })}
                        disabled={busy}
                        className={OUTLINE}
                      >
                        <Undo2 className="h-4 w-4" aria-hidden="true" />
                        Release
                      </button>
                    )}
                    <button type="button" onClick={() => act(d, "pickup")} disabled={busy} className={PRIMARY}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PackageCheck className="h-4 w-4" aria-hidden="true" />}
                      Picked Up
                    </button>
                  </>
                ) : (
                  <>
                    <a href={navigateUrl(d)} target="_blank" rel="noopener noreferrer" className={OUTLINE}>
                      <Navigation className="h-4 w-4" aria-hidden="true" />
                      Navigate
                    </a>
                    <button
                      type="button"
                      onClick={() => setOpenChatId((prev) => (prev === d.orderId ? null : d.orderId))}
                      aria-expanded={openChatId === d.orderId}
                      className={OUTLINE}
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      {openChatId === d.orderId ? "Hide Chat" : "Chat"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ kind: "deliver", delivery: d })}
                      disabled={busy}
                      className={PRIMARY}
                    >
                      <PackageCheck className="h-4 w-4" aria-hidden="true" />
                      Mark Delivered
                    </button>
                  </>
                )}
              </div>

              {!waiting && openChatId === d.orderId && (
                <ChatPanel
                  orderId={d.orderId}
                  viewerRole="RIDER"
                  fetchUrl={`/api/rider/deliveries/${d.orderId}/chat`}
                  sendUrl={`/api/rider/deliveries/${d.orderId}/chat`}
                  otherPartyLabel={d.customerName}
                  active
                />
              )}
            </article>
          );
        })
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
    <div className="flex items-start gap-3 rounded-[16px] border border-[#FFD9B8] bg-[#FFF7EF] p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF7100]" strokeWidth={1.5} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3 font-sora text-[13px] leading-[1.6] text-[#8A4300] md:text-[14px]">
        {status === "unsupported" ? (
          <p>Your browser can&apos;t share location. Open this page on your phone to show customers where you are.</p>
        ) : status === "far" ? (
          <p>
            Your device says you are {farKm !== null ? `about ${farKm.toLocaleString("en-US")} km` : "very far"} from
            the restaurant, so your position is <strong>not</strong> shown to the customer. Usually a VPN is on, or
            this is a computer without GPS — turn the VPN off or use your phone with location on.
          </p>
        ) : status === "denied" ? (
          <p>Location permission was denied. Allow location for this site in your browser settings, then reload.</p>
        ) : (
          <>
            <p>Share your live location so customers can see you on the map.</p>
            <button
              type="button"
              onClick={onStart}
              className="h-10 rounded-full bg-black px-4 font-sora text-[13px] font-semibold text-white hover:opacity-90"
            >
              Enable location sharing
            </button>
          </>
        )}
      </div>
    </div>
  );
}
