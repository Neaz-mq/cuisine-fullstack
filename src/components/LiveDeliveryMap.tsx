"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * src/components/LiveDeliveryMap.tsx
 *
 * Renders on the customer's /track/[orderId] page whenever an order has
 * an active DeliveryTracking row (see OrderTrackingTimeline.tsx). Uses
 * OpenStreetMap tiles (free, no API key/billing — matches the free
 * Nominatim geocoder in lib/geocode.ts) rather than Google Maps, and
 * custom inline-SVG markers via L.divIcon instead of Leaflet's default
 * marker image assets, which sidesteps the well-known Leaflet + bundler
 * "marker icon path is broken" issue entirely — no need to copy
 * leaflet/dist/images/*.png into /public.
 */

type LatLng = { lat: number; lng: number };

function riderDivIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;border-radius:9999px;background:#2C6252;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
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

function destDivIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:9999px 9999px 9999px 0;transform:rotate(45deg);background:#FF4C15;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

// Re-centers/fits the map whenever rider or destination position changes,
// without remounting the whole MapContainer (which would flash/reset zoom
// on every 15s poll).
function FitBounds({ rider, dest }: { rider: LatLng; dest: LatLng }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([
      [rider.lat, rider.lng],
      [dest.lat, dest.lng],
    ]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [rider.lat, rider.lng, dest.lat, dest.lng, map]);
  return null;
}

export default function LiveDeliveryMap({
  rider,
  destination,
  lastUpdatedAt,
}: {
  rider: LatLng;
  destination: LatLng;
  lastUpdatedAt: string;
}) {
  const [relativeTime, setRelativeTime] = useState("");

  useEffect(() => {
    function tick() {
      const seconds = Math.max(0, Math.floor((Date.now() - new Date(lastUpdatedAt).getTime()) / 1000));
      if (seconds < 60) setRelativeTime(`${seconds}s ago`);
      else if (seconds < 3600) setRelativeTime(`${Math.floor(seconds / 60)}m ago`);
      else setRelativeTime(`${Math.floor(seconds / 3600)}h ago`);
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lastUpdatedAt]);

  const riderIcon = useMemo(() => riderDivIcon(), []);
  const destIcon = useMemo(() => destDivIcon(), []);

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden mb-8">
      <div className="h-64 w-full relative">
        <MapContainer
          center={[rider.lat, rider.lng]}
          zoom={14}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[rider.lat, rider.lng]} icon={riderIcon} />
          <Marker position={[destination.lat, destination.lng]} icon={destIcon} />
          <Polyline
            positions={[
              [rider.lat, rider.lng],
              [destination.lat, destination.lng],
            ]}
            pathOptions={{ color: "#2C6252", weight: 3, dashArray: "6 6" }}
          />
          <FitBounds rider={rider} dest={destination} />
        </MapContainer>
      </div>
      <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
        <span>🟢 Your rider is on the way</span>
        <span>Updated {relativeTime}</span>
      </div>
    </div>
  );
}
