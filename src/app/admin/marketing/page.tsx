// src/app/admin/marketing/page.tsx
"use client";

import { useState } from "react";

export default function MarketingPage() {
  const [subject, setSubject] = useState("");
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [ctaText, setCtaText] = useState("Order Now");
  const [ctaUrl, setCtaUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  async function handleSend() {
    if (!subject.trim() || !message.trim()) {
      setResult({ type: "error", message: "Both subject and message body are required." });
      return;
    }

    const confirmed = window.confirm(
      "This offer will be sent to all subscribed customers. Are you sure you want to continue?"
    );
    if (!confirmed) return;

    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/marketing/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, headline, message, ctaText, ctaUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ type: "error", message: data.error || "Send failed." });
        return;
      }

      setResult({ type: "success", message: "Broadcast sent successfully!" });
      setSubject("");
      setHeadline("");
      setMessage("");
      setCtaText("Order Now");
      setCtaUrl("");
    } catch {
      setResult({ type: "error", message: "Network error — please try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-1">Send Offer to Subscribers</h1>
      <p className="text-sm text-gray-500 mb-6">
        This will only go to customers who have opted in to marketing emails.
        Recipients see a branded email with your headline, offer details, and
        a call-to-action button — matching the design of your order
        confirmation emails.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Subject line</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Weekend Special: 20% off on all pizzas!"
            className="w-full border rounded-lg px-3 py-2"
          />
          <p className="text-xs text-gray-400 mt-1">
            What shows in the recipient&apos;s inbox as the email subject.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Headline <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Defaults to the subject line if left blank"
            className="w-full border rounded-lg px-3 py-2"
          />
          <p className="text-xs text-gray-400 mt-1">
            The large bold text shown at the top of the email itself. Can be
            shorter and punchier than the subject line.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            placeholder={"This weekend only — enjoy 20% off every pizza on our menu.\nJust show this email at checkout, or order online now."}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">
            Just type normally. Press Enter to start a new line — each line
            becomes its own paragraph in the email.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Button text</label>
            <input
              type="text"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              placeholder="Order Now"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Button link <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="Defaults to your site's homepage"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        {result && (
          <div
            className={`p-3 rounded-lg text-sm ${
              result.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {result.message}
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={sending}
          className="bg-black text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send to All Subscribers"}
        </button>
      </div>
    </div>
  );
}