"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTableOrder } from "@/context/TableOrderContext";

export default function DineInClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTable } = useTableOrder();
  const [status, setStatus] = useState<"checking" | "invalid">("checking");

  const tableId = searchParams.get("table");

  useEffect(() => {
    if (!tableId) {
      setStatus("invalid");
      return;
    }

    let cancelled = false;

    async function validate() {
      try {
        const res = await fetch(`/api/tables/${tableId}`);
        if (!res.ok) {
          if (!cancelled) setStatus("invalid");
          return;
        }
        const table = await res.json();
        if (!table.isActive) {
          if (!cancelled) setStatus("invalid");
          return;
        }
        setTable(table.id, table.label);
        router.replace("/order");
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    }

    validate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  if (status === "invalid") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-gray-800 mb-2">
            This QR code isn&apos;t valid
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            The table code couldn&apos;t be verified — it may be inactive or
            mistyped. Please ask a staff member for help, or browse the menu
            below.
          </p>
          <a
            href="/order"
            className="inline-block bg-[#FF4C15] text-white font-semibold px-5 py-2 rounded-sm hover:bg-orange-600 transition-colors"
          >
            Browse the menu
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <p className="text-sm text-gray-500">Setting up your table…</p>
    </div>
  );
}
