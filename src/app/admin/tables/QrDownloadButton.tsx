"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { toast } from "react-toastify";

/**
 * src/app/admin/tables/QrDownloadButton.tsx
 *
 * Generates a QR code entirely client-side (no external QR API call) that
 * encodes `${origin}/dine-in?table=<tableId>` — scanning it lands the
 * customer on the /dine-in landing page, which validates the table and
 * drops them into the menu with dine-in checkout active.
 *
 * Uses window.location.origin at click time rather than a hardcoded/env
 * base URL, so the same code works correctly whether printed from
 * localhost during testing or from the deployed production domain.
 */
export default function QrDownloadButton({
  tableId,
  tableLabel,
}: {
  tableId: string;
  tableLabel: string;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleDownload() {
    setIsGenerating(true);
    try {
      const url = `${window.location.origin}/dine-in?table=${tableId}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: { dark: "#2C6252", light: "#FFFFFF" },
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `qr-${tableLabel.replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("QR generation failed:", error);
      toast.error("Couldn't generate the QR code. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isGenerating}
      className="text-sm text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50"
    >
      {isGenerating ? "Generating…" : "Download QR"}
    </button>
  );
}
