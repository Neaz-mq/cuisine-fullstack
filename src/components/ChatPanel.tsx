"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
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

// Supabase Realtime sends raw Postgres rows. Until the `createdAt` column is
// migrated to timestamptz, those raw values arrive WITHOUT a timezone
// marker (e.g. "2026-08-03T09:00:22.021" instead of "...021Z"), so
// `new Date(...)` parses them as local time instead of UTC and the
// receiving party sees a shifted timestamp. Force UTC when no marker
// is present. Safe to keep even after the DB migration lands.
function parseTimestamp(raw: string) {
  return new Date(/[Zz]|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`);
}

export default function ChatPanel({
  orderId,
  viewerRole,
  fetchUrl,
  sendUrl,
  otherPartyLabel,
  active,
  inactiveMessage,
  chrome = "card",
  visible = true,
  lastReadAt = 0,
  onUnreadChange,
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
  /**
   * "card"  — নিজস্ব খোলস আর শিরোনাম (rider dashboard, আগের মতোই)
   * "bare"  — খোলস নেই, শুধু কথোপকথন; ChatModal-এর ভেতরে এটা ব্যবহার
   *           হয়, কারণ শিরোনাম আর close বোতাম তখন modal-এর দায়িত্ব।
   *
   * ⚠️ দুটো আলাদা component না বানিয়ে একটাই রাখা হয়েছে: Realtime
   * subscription, reconnect backoff আর dedupe — এই তিনটে জটিল অংশ
   * দুবার লিখলে একটায় bug ঠিক করে অন্যটায় ভুলে যাওয়া নিশ্চিত।
   */
  chrome?: "card" | "bare";
  /**
   * ব্যবহারকারী এখন কথোপকথনটা **দেখছেন** কিনা (modal খোলা)।
   *
   * ⚠️ ChatPanel modal বন্ধ থাকলেও mount থাকে — না থাকলে Realtime
   * subscription-ও থাকত না, আর তখন নতুন বার্তা আসার খবরই পাওয়া যেত না।
   * তাই "দেখা হয়েছে" বোঝার জন্য এই prop-টা দরকার; শুধু mount হওয়া
   * যথেষ্ট নয়।
   */
  visible?: boolean;
  /**
   * শেষ কবে কথোপকথনটা পড়া হয়েছে, epoch ms। ০ = কখনো নয়।
   *
   * ⚠️ মালিকানা caller-এর, ChatPanel-এর নয় — সময়টা বদলায় কেবল
   * ব্যবহারকারীর ক্লিকে (চ্যাট খোলা/বন্ধ), আর সেটা একটা event, effect
   * নয়। ChatPanel-এর ভেতরে state হিসেবে রাখলে effect থেকে setState
   * করতে হতো, যা cascading render তৈরি করে (react-hooks/set-state-in-effect)।
   */
  lastReadAt?: number;
  /** অপঠিত বার্তার সংখ্যা — চ্যাট বোতামের badge-এর জন্য। */
  onUnreadChange?: (count: number) => void;
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
              addMessage(payload.new as ChatMessage);
            }
          )
          .subscribe((status, err) => {
            if (cancelled) return;
            if (status === "SUBSCRIBED") {
              attempt = 0; // connection is healthy again — reset backoff
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

  /**
   * অপঠিত = **অন্যজনের** পাঠানো, `lastReadAt`-এর পরে আসা বার্তা।
   *
   * ⚠️ নিজের পাঠানো বার্তা কখনো গোনা হয় না — নিজের কথা নিজের কাছে
   * "নতুন খবর" নয়।
   *
   * ⚠️ চ্যাট খোলা থাকলে সবসময় ০। খোলা অবস্থায় বার্তাগুলো চোখের সামনেই
   * আসছে, তাই সেগুলো গোনা মানে ব্যবহারকারীকে তাঁর সামনে থাকা জিনিসের
   * জন্য badge দেখানো।
   *
   * ⚠️ এটা state নয়, প্রতি render-এ হিসাব — `lastReadAt` আর `messages`
   * দুটোই ইতিমধ্যে আছে, তাই একই তথ্য দ্বিতীয়বার state-এ রাখলে দুটো
   * আলাদা হয়ে যাওয়ার সুযোগ তৈরি হতো।
   */
  const unreadCount = visible
    ? 0
    : messages.filter(
        (m) => m.senderRole !== viewerRole && parseTimestamp(m.createdAt).getTime() > lastReadAt
      ).length;

  useEffect(() => {
    onUnreadChange?.(unreadCount);
  }, [unreadCount, onUnreadChange]);

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

  const bare = chrome === "bare";

  return (
    <div
      className={
        bare
          ? "flex min-h-0 flex-1 flex-col gap-[22px]"
          : "flex flex-col overflow-hidden rounded-[20px] border border-black/10 bg-white"
      }
    >
      {!bare && (
        <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
          <MessageCircle className="h-4 w-4 text-[#FF9540]" aria-hidden="true" />
          <span className="font-sora text-[13px] font-semibold leading-none text-black">
            Chat with {otherPartyLabel}
          </span>
        </div>
      )}

      {/**
        * বার্তার তালিকা — Figma "Frame 2147236489", gap 16।
        *
        * ⚠️ modal-এ উচ্চতা flex দিয়ে ঠিক হয় (`flex-1 min-h-0`), স্থির
        * px-এ নয় — ছোট ফোনে Figma-র 413px চাপিয়ে দিলে input বাক্সটাই
        * পর্দার বাইরে চলে যেত। `min-h-0` ছাড়া flex child কখনো scroll
        * করে না, সে তার পুরো content-এর সমান উঁচু হয়ে যায়।
        */}
      <div
        ref={scrollRef}
        className={
          bare
            ? "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
            : "flex max-h-64 flex-col gap-4 overflow-y-auto px-4 py-3"
        }
      >
        {loaded && messages.length === 0 && (
          <p className="py-6 text-center font-sora text-[12px] leading-none text-black/40">
            No messages yet — say hello!
          </p>
        )}

        {messages.map((m) => {
          const isOwn = m.senderRole === viewerRole;
          return (
            <div key={m.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
              {/**
                * Figma "Chat Messege": নিজের বার্তা কমলা (#FF9540),
                * radius 16 0 16 16; অন্যজনের cream, radius 0 16 16 16।
                * কোণাটা কাটা থাকে যে পাশ থেকে বার্তাটা এসেছে।
                */}
              <div
                className={`max-w-[80%] px-4 py-3 font-sora text-[14px] leading-[1.5] ${
                  isOwn
                    ? "rounded-[16px_0_16px_16px] bg-[#FF9540] text-white shadow-[0_4px_24px_rgba(132,132,132,0.1)]"
                    : "rounded-[0_16px_16px_16px] bg-[#F9F6F3] text-black"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.message}</p>
              </div>
              {/* ⚠️ suppressHydrationWarning — সময়টা দর্শকের timezone-এ
                  সাজানো, তাই server (UTC) আর browser আলাদা লিখতে পারে। */}
              <span
                className="mt-1 px-1 font-sora text-[10px] leading-none text-black/40"
                suppressHydrationWarning
              >
                {parseTimestamp(m.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
      </div>

      {active ? (
        /**
         * Figma "Frame 2147235231": cream pill (radius 90), padding
         * 14/6/14/24, ডানে 44px কালো গোল বোতামে send আইকন।
         *
         * ⚠️ `<form>` ইচ্ছাকৃত — Enter চেপে পাঠানো আর মোবাইল কিবোর্ডের
         * "Send" বোতাম দুটোই এতে বিনা বাড়তি কোডে কাজ করে।
         */
        <form
          onSubmit={handleSend}
          className={`flex items-center gap-3 rounded-full bg-[#F9F6F3] py-[6px] pl-6 pr-[6px] ${
            bare ? "" : "mx-3 mb-3"
          }`}
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type here..."
            maxLength={1000}
            aria-label={`Message ${otherPartyLabel}`}
            className="min-w-0 flex-1 bg-transparent font-sora text-[15px] leading-[1.6] text-black placeholder:text-black/40 focus:outline-none md:text-[16px]"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white transition-opacity hover:opacity-80 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:opacity-40"
            aria-label="Send message"
          >
            {/* vuesax/linear/send-2 */}
            <svg
              className="h-[18px] w-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.11 13.87 20.92 3.06M11.42 16.58l2.06 5.31c.32.82 1.47.82 1.79 0l6.42-16.5c.29-.75-.44-1.48-1.19-1.19l-16.5 6.42c-.82.32-.82 1.47 0 1.79l5.31 2.06a1.5 1.5 0 0 1 .86.86Z" />
            </svg>
          </button>
        </form>
      ) : (
        inactiveMessage && (
          <p
            className={`text-center font-sora text-[12px] leading-[1.5] text-black/40 ${
              bare ? "" : "border-t border-black/5 px-4 py-3"
            }`}
          >
            {inactiveMessage}
          </p>
        )
      )}
    </div>
  );
}
