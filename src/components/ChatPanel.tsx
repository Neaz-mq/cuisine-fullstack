"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { supabase } from "@/lib/supabase-client";

/**
 * src/components/ChatPanel.tsx
 *
 * Rider <-> customer live chat, shared by both sides of the conversation:
 *   - RiderDashboard.tsx renders one per assigned delivery
 *     (fetchUrl/sendUrl -> /api/rider/deliveries/[orderId]/chat)
 *   - OrderTrackingTimeline.tsx renders one for the customer
 *     (fetchUrl/sendUrl -> /api/orders/[id]/chat)
 *
 * New messages arrive via Supabase Realtime (a Postgres change feed),
 * not the 15s polling pattern used elsewhere in this app.
 *
 * Realtime requires two things on the Supabase side, or the sender's
 * message will only show up for the OTHER party after a manual refresh:
 *   1. ChatMessage must be in the `supabase_realtime` publication
 *      (see prisma/migrations/*_enable_chat_realtime/migration.sql)
 *   2. anon/authenticated roles need SELECT grant on ChatMessage — this
 *      is automatic for tables created via Supabase Studio, but NOT for
 *      tables created via Prisma migrations, so it has to be granted
 *      explicitly (see prisma/migrations/*_grant_chatmessage_select/migration.sql)
 */

type ChatMessage = {
  id: string;
  senderRole: "RIDER" | "CUSTOMER";
  senderName: string;
  message: string;
  createdAt: string;
};

export default function ChatPanel({
  orderId,
  viewerRole,
  fetchUrl,
  sendUrl,
  otherPartyLabel,
  active,
  inactiveMessage,
}: {
  orderId: string;
  viewerRole: "RIDER" | "CUSTOMER";
  fetchUrl: string;
  sendUrl: string;
  /** e.g. "Jahin khan" (rider's view) or "your rider" (customer's view) —
   * used only for the panel header. */
  otherPartyLabel: string;
  /** Whether sending is currently allowed (order is OUT_FOR_DELIVERY and
   * not yet delivered). History always stays visible even when false. */
  active: boolean;
  /** Shown in place of the input when `active` is false. */
  inactiveMessage?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dedupe helper — both the optimistic append after a successful POST
  // and the Realtime push for that same row can arrive, in either order.
  function addMessage(incoming: ChatMessage) {
    setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(fetchUrl);
        if (!res.ok || cancelled) return;
        const data: ChatMessage[] = await res.json();
        if (!cancelled) setMessages(data);
      } catch {
        // network error on initial load — the Realtime subscription below
        // will still populate anything sent after this point.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchUrl]);

  useEffect(() => {
    // Realtime is a nice-to-have layered on top of the fetch-on-mount
    // above, which already loads full history — if channel setup throws
    // or the subscription never connects, the chat should just fall back
    // to "history only, no live push" instead of taking the entire page
    // down with it.
    //
    // Auto-reconnect matters: a rider is on a phone, on the move, on
    // mobile data — the connection WILL drop mid-delivery in normal use.
    // Without retrying, one dropped connection would silently degrade the
    // chat to history-only (next fetch on remount/refresh) for the rest
    // of the delivery. Backoff caps at 10s so a genuinely offline device
    // isn't hammering reconnect attempts.
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    function connect() {
      if (cancelled) return;
      try {
        channel = supabase
          .channel(`chat:${orderId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "ChatMessage", filter: `orderId=eq.${orderId}` },
            (payload) => {
              console.log(`Chat realtime INSERT received for order ${orderId}:`, payload.new);
              addMessage(payload.new as ChatMessage);
            }
          )
          .subscribe((status, err) => {
            if (cancelled) return;
            if (status === "SUBSCRIBED") {
              attempt = 0; // connection is healthy again — reset backoff
              console.log(`Chat realtime channel for order ${orderId}: SUBSCRIBED`);
              return;
            }
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              console.error(`Chat realtime channel for order ${orderId}: ${status} — reconnecting`, err);
              if (channel) supabase.removeChannel(channel);
              const delay = Math.min(1000 * 2 ** attempt, 10000);
              attempt += 1;
              retryTimer = setTimeout(connect, delay);
            }
          });
      } catch (err) {
        console.error("Chat realtime subscription failed — retrying:", err);
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        attempt += 1;
        retryTimer = setTimeout(connect, delay);
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [orderId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const res = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        const created: ChatMessage = await res.json();
        addMessage(created);
        setDraft("");
      }
    } catch {
      // best-effort — the message simply doesn't send; draft text stays
      // in the input so the user can retry instead of losing what they typed
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-md bg-white flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <MessageCircle className="w-4 h-4 text-[#2C6252]" />
        <span className="text-sm font-semibold text-gray-800">
          Chat with {otherPartyLabel}
        </span>
      </div>

      <div ref={scrollRef} className="max-h-64 overflow-y-auto px-4 py-3 space-y-2">
        {loaded && messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">
            No messages yet — say hello!
          </p>
        )}
        {messages.map((m) => {
          const isOwn = m.senderRole === viewerRole;
          return (
            <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  isOwn ? "bg-[#2C6252] text-white" : "bg-gray-100 text-gray-800"
                }`}
              >
                <p>{m.message}</p>
                <p className={`text-[10px] mt-0.5 ${isOwn ? "text-white/70" : "text-gray-400"}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {active ? (
        <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-3 border-t border-gray-100">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            maxLength={1000}
            className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30 focus:border-[#2C6252]"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="shrink-0 bg-[#FF4C15] text-white rounded-md p-2.5 hover:bg-[#e6430f] transition-colors disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      ) : (
        inactiveMessage && (
          <p className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
            {inactiveMessage}
          </p>
        )
      )}
    </div>
  );
}