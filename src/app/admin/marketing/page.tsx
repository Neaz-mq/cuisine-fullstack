// src/app/admin/marketing/page.tsx
"use client";

import { useState } from "react";

export default function MarketingPage() {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  async function handleSend() {
    if (!subject.trim() || !html.trim()) {
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
        body: JSON.stringify({ subject, html }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ type: "error", message: data.error || "Send failed." });
        return;
      }

      setResult({ type: "success", message: "Broadcast sent successfully!" });
      setSubject("");
      setHtml("");
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
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Weekend Special: 20% off on all pizzas!"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Message (HTML supported)
          </label>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={10}
            placeholder="<h2>Special offer this week!</h2><p>...</p>"
            className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
          />
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