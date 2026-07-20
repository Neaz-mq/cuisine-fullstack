"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Navigation, PackageCheck, Phone, MapPin, AlertCircle } from "lucide-react";
import { formatOrderId } from "@/lib/format-order-id";

const POLL_INTERVAL_MS = 15000; // same cadence as KitchenBoard / OrderTrackingTimeline

export type Delivery = {
  orderId: string;
  status: string;
  customerName: string;
  phone: string;
  address: string;
  totalAmount: number;
  paymentMethod: "COD" | "ONLINE";
  destLat: number;
  destLng: number;
  assignedAt: string;
};

// This is browser-based tracking — location only broadcasts while this
// tab is open and the browser tab/screen stays active. It is NOT a
// native background-GPS app: if the rider locks their phone or closes
// the tab, position updates pause until they reopen it. Documented here
// (and shown to the rider below) rather than silently failing to meet an
// expectation of always-on tracking.
export default function RiderDashboard({ initialDeliveries }: { initialDeliveries: Delivery[] }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries);
  const [geoStatus, setGeoStatus] = useState<"idle" | "active" | "denied" | "unsupported">(
    "idle"
  );
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const activeOrderIdsRef = useRef<string[]>(initialDeliveries.map((d) => d.orderId));

  const loadDeliveries = useCallback(async () => {
    try {
      const res = await fetch("/api/rider/deliveries");
      if (!res.ok) return;
      const data: Delivery[] = await res.json();
      setDeliveries(data);
      activeOrderIdsRef.current = data.map((d) => d.orderId);
    } catch {
      // network error — silently retry on the next poll
    }
  }, []);

  // Initial data already came from the server (initialDeliveries) — this
  // effect only needs to set up the recurring poll for subsequent
  // updates, same SSR-initial + poll pattern as KitchenBoard.tsx.
  useEffect(() => {
    const interval = setInterval(loadDeliveries, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadDeliveries]);

  // Geolocation broadcasting — one watchPosition subscription for the
  // whole page, fanned out to every currently-active order (usually just
  // one, but a rider could have two orders out at once). Started once the
  // rider explicitly grants permission via the button below, not
  // automatically on page load — an unprompted geolocation request tends
  // to get silently blocked by the browser anyway.
  const startSharing = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unsupported");
      return;
    }
    navigator.geolocation.watchPosition(
      (pos) => {
        setGeoStatus("active");
        const { latitude, longitude } = pos.coords;
        activeOrderIdsRef.current.forEach((orderId) => {
          fetch(`/api/rider/deliveries/${orderId}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          }).catch(() => {
            // best-effort — next position update will retry
          });
        });
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }, []);

  async function handleDeliver(orderId: string) {
    setDeliveringId(orderId);
    try {
      const res = await fetch(`/api/rider/deliveries/${orderId}/deliver`, { method: "POST" });
      if (res.ok) {
        setDeliveries((prev) => prev.filter((d) => d.orderId !== orderId));
        activeOrderIdsRef.current = activeOrderIdsRef.current.filter((id) => id !== orderId);
      }
    } finally {
      setDeliveringId(null);
    }
  }

  function navigateUrl(d: Delivery) {
    return `https://www.google.com/maps/dir/?api=1&destination=${d.destLat},${d.destLng}&travelmode=driving`;
  }

  return (
    <div>
      {geoStatus !== "active" && (
        <div className="border border-orange-200 bg-orange-50 rounded-md p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#FF4C15] shrink-0 mt-0.5" />
          <div className="flex-1">
            {geoStatus === "unsupported" ? (
              <p className="text-sm text-orange-700">
                Your browser doesn&apos;t support location sharing. Use a phone browser to share your
                live position with customers.
              </p>
            ) : geoStatus === "denied" ? (
              <p className="text-sm text-orange-700">
                Location permission was denied. Enable location access for this site in your
                browser settings, then reload this page.
              </p>
            ) : (
              <>
                <p className="text-sm text-orange-700 mb-2">
                  Share your live location so customers can see you on the map.
                </p>
                <button
                  onClick={startSharing}
                  className="text-xs font-semibold bg-[#2C6252] text-white px-3 py-1.5 rounded-md hover:bg-[#234f42] transition-colors"
                >
                  Enable location sharing
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {geoStatus === "active" && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-6">
          🟢 Sharing your live location — keep this tab open while delivering.
        </p>
      )}

      {deliveries.length === 0 ? (
        <div className="border border-gray-200 rounded-md p-8 text-center">
          <p className="text-sm text-gray-500">No deliveries assigned to you right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {deliveries.map((d) => (
            <div key={d.orderId} className="border border-gray-200 rounded-md p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-mono text-gray-500">{formatOrderId(d.orderId)}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                  {d.status.replace(/_/g, " ")}
                </span>
              </div>

              <p className="font-semibold text-gray-800">{d.customerName}</p>
              <p className="text-sm text-gray-600 flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                {d.address}
              </p>
              <a
                href={`tel:${d.phone}`}
                className="text-sm text-gray-600 flex items-center gap-1.5 mt-1 hover:text-[#2C6252]"
              >
                <Phone className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                {d.phone}
              </a>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-gray-200">
                <span className="text-sm font-semibold text-[#2C6252]">
                  USD ${d.totalAmount.toFixed(2)}{" "}
                  <span className="text-xs font-normal text-gray-400">
                    {d.paymentMethod === "COD" ? "· Collect cash" : "· Paid online"}
                  </span>
                </span>
              </div>

              <div className="flex gap-2 mt-4">
                <a
                  href={navigateUrl(d)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold border border-[#2C6252] text-[#2C6252] rounded-md py-2 hover:bg-[#2C6252] hover:text-white transition-colors"
                >
                  <Navigation className="w-4 h-4" />
                  Navigate
                </a>
                <button
                  onClick={() => handleDeliver(d.orderId)}
                  disabled={deliveringId === d.orderId}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold bg-[#FF4C15] text-white rounded-md py-2 hover:bg-[#e6430f] transition-colors disabled:opacity-50"
                >
                  <PackageCheck className="w-4 h-4" />
                  {deliveringId === d.orderId ? "Marking…" : "Mark Delivered"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
