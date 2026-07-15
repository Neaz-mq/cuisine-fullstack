"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import Container from "@/components/Container";

const PRESET_AMOUNTS = [25, 50, 75, 100];

export default function GiftCardPurchase() {
  const searchParams = useSearchParams();

  const [selectedAmount, setSelectedAmount] = useState<number | null>(50);
  const [customAmount, setCustomAmount] = useState("");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [purchaserName, setPurchaserName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [isGift, setIsGift] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Return-from-Stripe feedback — same success/cancelled query-param
  // pattern used on /track and /carts after the hosted Checkout redirect.
  useEffect(() => {
    const purchase = searchParams.get("purchase");
    if (purchase === "success") {
      toast.success("Thanks! Your gift card is on its way by email.", {
        position: "top-center",
        autoClose: 3000,
        hideProgressBar: true,
      });
    } else if (purchase === "cancelled") {
      toast.info("Gift card purchase was cancelled.", {
        position: "top-center",
        autoClose: 3000,
        hideProgressBar: true,
      });
    }
  }, [searchParams]);

  const amount = selectedAmount ?? Number(customAmount);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!Number.isFinite(amount) || amount < 5 || amount > 500) {
      setError("Choose or enter an amount between $5 and $500");
      return;
    }
    if (!purchaserEmail.trim()) {
      setError("Your email is required");
      return;
    }
    if (isGift && !recipientEmail.trim()) {
      setError("Recipient email is required for a gift");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/gift-cards/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          purchaserEmail,
          purchaserName: purchaserName || undefined,
          recipientEmail: isGift ? recipientEmail : undefined,
          recipientName: isGift ? recipientName : undefined,
          message: isGift ? message : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "Failed to start checkout. Please try again.");
        setIsSubmitting(false);
        return;
      }

      window.location.href = data.url; // full navigation — Stripe's page is a different origin
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <Container>
      <div className="max-w-xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Cuisine Gift Cards</h1>
        <p className="text-gray-500 mb-8">
          Buy one for yourself or send it as a gift — redeemable at checkout, in full or across
          multiple orders.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-gray-200 rounded-md p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Choose an amount</label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(preset);
                    setCustomAmount("");
                  }}
                  className={`py-2 rounded-md text-sm font-semibold border transition-colors ${
                    selectedAmount === preset
                      ? "bg-[#2C6252] text-white border-[#2C6252]"
                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  ${preset}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="5"
              max="500"
              step="1"
              placeholder="Or enter a custom amount ($5–$500)"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedAmount(null);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your email</label>
            <input
              type="email"
              value={purchaserEmail}
              onChange={(e) => setPurchaserEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your name (optional)</label>
            <input
              type="text"
              value={purchaserName}
              onChange={(e) => setPurchaserName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
            This is a gift for someone else
          </label>

          {isGift && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient email</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="friend@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient name</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal message (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#FF4C15] text-white font-semibold py-3 rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Redirecting to checkout…" : `Buy Gift Card${amount ? ` — $${amount}` : ""}`}
          </button>
        </form>
      </div>
    </Container>
  );
}
