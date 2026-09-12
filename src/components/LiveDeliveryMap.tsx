"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AttributionControl,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import Image from "next/image";
import "leaflet/dist/leaflet.css";

/**
 * src/components/LiveDeliveryMap.tsx
 *
 * Figma "Frame 2147225650" — /track পাতার map কার্ড।
 *
 *   1280 × 573, radius 20, নিচে ২৫৪px কালো gradient
 *   বাঁ-নিচে: "Arriving in" (12px, white/70) + "25-30 min" (36px Frank Ruhl)
 *   ডান-নিচে: 60px কালো গোল, gps আইকন
 *   পথের রেখা: কালো, 3px
 *
 * ⚠️ Figma-র ছবিটা একটা স্থির নমুনা map; এখানে আসল OpenStreetMap, আর যা
 * আঁকা হয় তা অর্ডারের অবস্থার উপর নির্ভর করে:
 *
 *   rider পথে (live স্থানাঙ্ক আছে) → rider থেকে গ্রাহক
 *   এখনো রান্নাঘরে                → রেস্তোরাঁ থেকে গ্রাহক
 *   গ্রাহকের স্থানাঙ্ক নেই          → শুধু রেস্তোরাঁ
 *
 * ⚠️ রেখাটা সোজা, রাস্তা ধরে নয় — আমাদের কোনো routing service নেই।
 * রাস্তার একটা আঁকাবাঁকা পথ বানিয়ে দেখালে সেটা এমন নির্ভুলতার ভান করত
 * যা আমাদের কাছে নেই।
 *
 * ⚠️ gps বোতামটা সাজসজ্জা নয়: ব্যবহারকারী map টেনে সরিয়ে দিলে সব পিন আবার
 * পর্দায় ফিরিয়ে আনে।
 */

type LatLng = { lat: number; lng: number };

function riderDivIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;border-radius:9999px;background:#000;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
        <path d="M15 18H9"/>
        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
        <circle cx="17" cy="18" r="2"/>
        <circle cx="7" cy="18" r="2"/>
      </svg>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

/** রেস্তোরাঁ — Figma-র সবুজ পিনের জায়গায়, ব্র্যান্ডের কমলা। */
function originDivIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:#FF9540;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
}

/** গ্রাহকের ঠিকানা — Figma-র লাল পিন। */
function destDivIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:32px;height:32px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:#EA4335;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><div style="width:9px;height:9px;border-radius:9999px;background:#A50E0E;"></div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

/**
 * পিনগুলো পর্দায় আনে। `fitKey` বদলালে (gps বোতাম) আবার চলে।
 *
 * ⚠️ MapContainer remount না করে — ১৫ সেকেন্ডের প্রতিটা poll-এ remount
 * হলে map ঝলসে উঠত আর zoom রিসেট হতো।
 */
function FitToPoints({ points, fitKey }: { points: LatLng[]; fitKey: number }) {
  const map = useMap();
  const signature = points.map((p) => `${p.lat},${p.lng}`).join("|");

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
      return;
    }
    map.fitBounds(
      L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])),
      { padding: [60, 60], maxZoom: 16 }
    );
    // `points` নিজে প্রতি render-এ নতুন array — `signature` দিয়েই তুলনা।
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, fitKey, map]);

  return null;
}

export default function LiveDeliveryMap({
  origin,
  destination,
  rider,
  riderUpdatedAt,
  caption,
  headline,
  riderName,
  riderImage,
  onOpenChat,
}: {
  origin: LatLng;
  destination: LatLng | null;
  rider: LatLng | null;
  riderUpdatedAt: string | null;
  /** ছোট লেখা — "Arriving in"। */
  caption: string;
  /** বড় লেখা — "25-30 min"। */
  headline: string;
  /**
   * Figma "Frame 2147229466" — map-এর ডান-নিচের rider pill।
   *
   * ⚠️ নাম না থাকলে পুরো pill আর chat বোতাম দুটোই থাকে না। rider বসানোর
   * আগেই ("Preparing" থেকে সরাসরি OUT_FOR_DELIVERY) একটা ফাঁকা মুখ আর
   * নিষ্ক্রিয় chat বোতাম দেখানোর চেয়ে কিছু না দেখানোই সৎ।
   */
  riderName?: string | null;
  riderImage?: string | null;
  onOpenChat?: () => void;
}) {
  const [fitKey, setFitKey] = useState(0);
  const [relativeTime, setRelativeTime] = useState("");

  useEffect(() => {
    if (!riderUpdatedAt) return;
    function tick() {
      const seconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(riderUpdatedAt as string).getTime()) / 1000)
      );
      if (seconds < 60) setRelativeTime(`${seconds}s ago`);
      else if (seconds < 3600) setRelativeTime(`${Math.floor(seconds / 60)}m ago`);
      else setRelativeTime(`${Math.floor(seconds / 3600)}h ago`);
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [riderUpdatedAt]);

  const riderIcon = useMemo(() => riderDivIcon(), []);
  const originIcon = useMemo(() => originDivIcon(), []);
  const destIcon = useMemo(() => destDivIcon(), []);

  // পথ শুরু হয় rider থেকে (পথে থাকলে), নইলে রেস্তোরাঁ থেকে।
  const start = rider ?? origin;
  const points = [start, ...(destination ? [destination] : [])];

  return (
    <div className="relative isolate h-[300px] w-full overflow-hidden rounded-[20px] bg-black/5 md:h-[440px] xl:h-[573px]">
      <MapContainer
        center={[start.lat, start.lng]}
        zoom={14}
        scrollWheelZoom={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* ⚠️ Attribution উপরে-ডানে সরানো — ডিফল্ট জায়গা (নিচে-ডানে)
            Figma-র gps বোতাম আর gradient-এর নিচে ঢাকা পড়ত। OSM-এর
            শর্তে এটা দৃশ্যমান থাকতেই হবে। */}
        <AttributionControl position="topright" />

        {!rider && <Marker position={[origin.lat, origin.lng]} icon={originIcon} />}
        {rider && <Marker position={[rider.lat, rider.lng]} icon={riderIcon} />}
        {destination && (
          <>
            <Marker position={[destination.lat, destination.lng]} icon={destIcon} />
            <Polyline
              positions={[
                [start.lat, start.lng],
                [destination.lat, destination.lng],
              ]}
              pathOptions={{ color: "#000000", weight: 3 }}
            />
          </>
        )}
        <FitToPoints points={points} fitKey={fitKey} />
      </MapContainer>

      {/**
        * Figma "Rectangle 34628975": 254/573 ≈ 44% উঁচু, নিচে পুরো কালো।
        *
        * ⚠️ `pointer-events-none` — নাহলে map-এর নিচের অর্ধেক টানা বা
        * zoom করা যেত না। Leaflet-এর pane-গুলো z-index 400+ ব্যবহার করে,
        * তাই overlay-কে z-[1000] দিতে হয়।
        */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] h-[44%] bg-[linear-gradient(0.83deg,#000000_0.71%,rgba(0,0,0,0)_95.62%)]"
      />

      <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[1000] flex items-end justify-between gap-4 md:inset-x-6 md:bottom-6 xl:inset-x-9 xl:bottom-9">
        <div className="flex min-w-0 flex-col gap-1 md:gap-2">
          <span className="font-sora text-[12px] leading-[1.6] text-white/70">
            {caption}
            {riderUpdatedAt && relativeTime && ` · updated ${relativeTime}`}
          </span>
          <span className="font-frank-ruhl text-[24px] font-medium leading-[1.3] text-white md:text-[30px] xl:text-[36px]">
            {headline}
          </span>
        </div>

        {/**
          * Figma "Frame 2147236161": ডান পাশে খাড়া স্তম্ভ, gap 24 —
          * উপরে gps বোতাম, নিচে chat বোতাম + rider pill।
          */}
        <div className="flex shrink-0 flex-col items-end gap-3 md:gap-6">
          <button
            type="button"
            onClick={() => setFitKey((key) => key + 1)}
            aria-label="Re-center map"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black text-white transition-opacity hover:opacity-80 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] md:h-[60px] md:w-[60px]"
          >
            {/* vuesax/linear/gps */}
            <svg
              className="h-6 w-6 md:h-[30px] md:w-[30px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="7.5" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2.5M2 12h2.5M12 22v-2.5M22 12h-2.5" />
            </svg>
          </button>

          {riderName && (
            <div className="flex items-center gap-3 md:gap-5">
              {onOpenChat && (
                <button
                  type="button"
                  onClick={onOpenChat}
                  aria-label={`Chat with ${riderName}`}
                  className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E5EDFF] text-[#0090FF] transition-opacity hover:opacity-80 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] md:h-[72px] md:w-[72px]"
                >
                  {/* vuesax/linear/message */}
                  <svg
                    className="h-6 w-6 md:h-9 md:w-9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M8.5 19h-.5a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6v5a6 6 0 0 1-6 6h-.5l-3.5 2.5L8.5 19Z" />
                    <path d="M15.5 10.5h.01M11.99 10.5H12M8.49 10.5h.01" strokeWidth="2.5" />
                  </svg>
                </button>
              )}

              {/* Figma "Frame 2147229466": cream pill, radius 90, বাঁয়ে
                  48px গোল ছবি, তারপর নাম আর ভূমিকা। */}
              <div className="flex min-w-0 items-center gap-3 rounded-full bg-[#F9F6F3] py-[6px] pl-[6px] pr-5 md:py-3 md:pl-3 md:pr-[30px]">
                {riderImage ? (
                  <Image
                    src={riderImage}
                    alt=""
                    width={48}
                    height={48}
                    aria-hidden="true"
                    className="h-9 w-9 shrink-0 rounded-full object-cover md:h-12 md:w-12"
                  />
                ) : (
                  /* ছবি না থাকলে নামের প্রথম অক্ষর — ভাঙা ছবির আইকনের
                     চেয়ে ভালো, আর মাপটা একই থাকে বলে pill লাফায় না। */
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF9540] font-sora text-[14px] font-semibold text-white md:h-12 md:w-12 md:text-[16px]"
                  >
                    {riderName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-frank-ruhl text-[14px] font-medium leading-[1.2] text-black md:text-[16px]">
                    {riderName}
                  </span>
                  <span className="truncate font-sora text-[11px] leading-[1.2] text-black/70 md:text-[12px]">
                    Your Delivery Rider
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
