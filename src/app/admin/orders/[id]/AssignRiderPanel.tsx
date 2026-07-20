"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Truck } from "lucide-react";

type Rider = { id: string; name: string; phone: string | null };

export default function AssignRiderPanel({
  orderId,
  currentRiderId,
}: {
  orderId: string;
  currentRiderId: string | null;
}) {
  const router = useRouter();
  const [riders, setRiders] = useState<Rider[] | null>(null);
  const [selected, setSelected] = useState(currentRiderId ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/riders")
      .then((res) => (res.ok ? res.json() : []))
      .then(setRiders)
      .catch(() => setRiders([]));
  }, []);

  async function handleAssign() {
    if (!selected) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/assign-rider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riderId: selected }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not assign rider");
        return;
      }
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-md p-4 bg-white">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Truck className="w-4 h-4" />
        Delivery Rider
      </h2>

      {riders === null ? (
        <p className="text-sm text-gray-400">Loading riders…</p>
      ) : riders.length === 0 ? (
        <p className="text-sm text-gray-500">
          No active delivery staff yet. Add one from{" "}
          <Link href="/admin/staff/new" className="text-[#FF4C15] hover:underline">
            Staff → Add staff
          </Link>{" "}
          with the &quot;DELIVERY&quot; role.
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Select a rider…</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.phone ? ` · ${r.phone}` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={handleAssign}
              disabled={!selected || isSubmitting || selected === currentRiderId}
              className="text-sm font-semibold bg-[#2C6252] text-white px-4 py-2 rounded-md hover:bg-[#234f42] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Assigning…" : currentRiderId ? "Reassign" : "Assign"}
            </button>
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          {currentRiderId && !error && (
            <p className="text-xs text-gray-400 mt-2">
              Live tracking is active — the customer&apos;s tracking page shows this rider&apos;s position.
            </p>
          )}
        </>
      )}
    </div>
  );
}
