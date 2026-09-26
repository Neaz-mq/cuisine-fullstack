"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-toastify";
import {
  ArrowUp,
  Clock,
  Mic,
  MicOff,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useCart } from "@/context/CartContext";
import type { AssistantAnswer, AssistantDish, AssistantOrder } from "@/lib/ai-assistant/core";

/**
 * "Ask Cuisine AI" — the customer food assistant.
 *
 * A floating button on every customer page opens a chat that can:
 *   • recommend dishes by taste, diet, budget or group size — as cards
 *     with an Add button, straight into the cart
 *   • explain a dish (ingredients, calories, protein, prep time, rating)
 *   • list the offers and coupon codes running right now
 *   • tell a signed-in customer their points, tier, and where their order is
 *   • answer opening hours and delivery fees
 * in English or Bangla, typed or spoken (the browser's own speech
 * recognition — free, nothing sent to a paid service).
 *
 * The conversation is kept for the browser tab (sessionStorage), so moving
 * between pages doesn't lose it. Answers come from /api/ai/chat.
 */

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  dishes?: AssistantDish[];
  orders?: AssistantOrder[];
  suggestions?: string[];
  kitchenOpen?: boolean;
  source?: "ai" | "basic" | "direct";
  failed?: boolean;
};

const STORAGE_KEY = "cuisine-ai-chat";
const MAX_INPUT = 500;
const GRADIENT = "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)]";

const STARTERS = [
  { en: "What's popular today?", bn: "আজ সবচেয়ে জনপ্রিয় কী?" },
  { en: "Something spicy under $15", bn: "১৫ ডলারের মধ্যে ঝাল কিছু" },
  { en: "Vegetarian options", bn: "নিরামিষ কী আছে?" },
  { en: "Any offers or coupon codes?", bn: "কোনো অফার বা কুপন আছে?" },
  { en: "Dinner for 3 people", bn: "৩ জনের ডিনার সাজেস্ট করো" },
  { en: "Where's my order?", bn: "আমার অর্ডার কোথায়?" },
];

const newId = () => Math.random().toString(36).slice(2, 10);

/**
 * The saved chat and WHO it belongs to ("guest" or the user id). A chat
 * can show someone's orders and points, so it must never be shown to the
 * next person on a shared computer — see the owner check in the component.
 */
type Stored = { owner: string | null; messages: UiMessage[] };

function loadStored(): Stored {
  if (typeof window === "undefined") return { owner: null, messages: [] };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Stored> | UiMessage[]) : null;
    if (!parsed || Array.isArray(parsed)) return { owner: null, messages: [] };
    return {
      owner: typeof parsed.owner === "string" ? parsed.owner : null,
      messages: Array.isArray(parsed.messages) ? parsed.messages.slice(-30) : [],
    };
  } catch {
    return { owner: null, messages: [] };
  }
}

// Web Speech API types aren't in TS's DOM lib everywhere.
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};

function getRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function AiAssistant() {
  const { cartItems, addToCart } = useCart();
  const [open, setOpen] = useState(false);
  const [stored] = useState(loadStored);
  const [messages, setMessages] = useState<UiMessage[]>(stored.messages);
  const [owner, setOwner] = useState<string | null>(stored.owner);

  // Signed in, signed out or switched account → start a fresh chat, so a
  // previous customer's orders and points never show for the next person.
  // (Set during render, React's pattern for "reset state when X changes".)
  const { data: session, status } = useSession();
  const currentOwner = status === "loading" ? null : (session?.user?.id ?? "guest");
  if (currentOwner !== null && currentOwner !== owner) {
    setOwner(currentOwner);
    if (owner !== null) setMessages([]);
  }
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported] = useState(() => getRecognition() !== null);
  const [preferBangla, setPreferBangla] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Keep the chat for this tab.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ owner, messages: messages.slice(-30) } satisfies Stored)
      );
    } catch {
      // Private mode / storage full — the chat just won't survive a reload.
    }
  }, [messages, owner]);

  // Newest message in view.
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  // Escape closes; the page behind doesn't scroll on phones while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const small = window.matchMedia("(max-width: 639px)").matches;
    const previous = document.body.style.overflow;
    if (small) document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 150);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  async function send(text: string) {
    const content = text.trim().slice(0, MAX_INPUT);
    if (!content || sending) return;

    const userMessage: UiMessage = { id: newId(), role: "user", content };
    const history = [...messages.filter((m) => !m.failed), userMessage];
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);
    if (/[ঀ-৿]/.test(content)) setPreferBangla(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-9).map((m) => ({ role: m.role, content: m.content })),
          cart: cartItems.map((item) => ({ id: item.id, quantity: item.quantity })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<AssistantAnswer> & { error?: string };
      if (!res.ok || !data.reply) {
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: data.reply as string,
          dishes: data.dishes ?? [],
          orders: data.orders ?? [],
          suggestions: data.suggestions ?? [],
          kitchenOpen: data.kitchenOpen ?? true,
          source: data.source,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: error instanceof Error ? error.message : "Something went wrong. Please try again.",
          failed: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = getRecognition();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = preferBangla ? "bn-BD" : "en-US";
    // Live words while speaking — the customer SEES it's hearing them,
    // instead of staring at an empty box until they stop talking.
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    const before = input.trim();
    let heardAnything = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i]?.[0]?.transcript ?? "";
      }
      transcript = transcript.trim();
      if (!transcript) return;
      heardAnything = true;
      setInput(`${before ? `${before} ` : ""}${transcript}`.slice(0, MAX_INPUT));
    };
    recognition.onend = () => {
      setListening(false);
      if (heardAnything) inputRef.current?.focus();
    };
    // The browser says WHY it failed — tell the customer the real reason
    // instead of one generic line.
    recognition.onerror = (event) => {
      setListening(false);
      const reason = event?.error ?? "";
      if (reason === "aborted") return; // they pressed stop
      const message =
        reason === "not-allowed" || reason === "service-not-allowed"
          ? "Microphone is blocked. Click the lock icon next to the address bar → allow Microphone, then try again."
          : reason === "no-speech"
            ? "Didn't catch anything — tap the mic and start speaking."
            : reason === "audio-capture"
              ? "No microphone found. Check your headset or mic is connected."
              : reason === "network"
                ? "Voice needs an internet connection (the browser sends audio to its speech service). Please type instead."
                : reason === "language-not-supported"
                  ? "This browser can't do voice in this language — please type instead."
                  : "Couldn't hear that — please try again or type your question.";
      toast.error(message, { position: "top-center", autoClose: 4000, hideProgressBar: true });
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function handleAdd(dish: AssistantDish) {
    addToCart({
      id: dish.id,
      title: dish.title,
      price: dish.price,
      quantity: 1,
      imageUrl: dish.imageUrl ?? undefined,
      description: dish.description,
    });
    toast.success(`${dish.title} added to cart`, {
      position: "top-center",
      autoClose: 1800,
      hideProgressBar: true,
    });
  }

  function resetChat() {
    recognitionRef.current?.stop();
    setMessages([]);
    setInput("");
    setPreferBangla(false);
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && !m.failed);
  const starterLang = preferBangla ? "bn" : "en";

  return (
    <>
      {/* ── Launcher ── */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="launcher"
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.8, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            aria-label="Ask Cuisine AI — your food assistant"
            className={`group fixed bottom-4 right-4 z-[60] flex h-14 items-center gap-2 rounded-full ${GRADIENT} px-3 font-sora text-[14px] font-semibold text-white shadow-[0_10px_30px_rgba(255,112,80,0.35)] transition-transform hover:scale-[1.03] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:3px] min-[640px]:bottom-6 min-[640px]:right-6`}
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
              <span className="absolute inset-0 animate-ping rounded-full bg-white/25 [animation-duration:2.4s]" />
            </span>
            <span className="hidden min-[400px]:inline min-[400px]:pr-2">Ask Cuisine AI</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Chat panel ── */}
      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            role="dialog"
            aria-modal="false"
            aria-label="Cuisine AI chat"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-white min-[640px]:inset-auto min-[640px]:bottom-6 min-[640px]:right-6 min-[640px]:h-[min(640px,calc(100vh-48px))] min-[640px]:w-[400px] min-[640px]:rounded-[24px] min-[640px]:shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
          >
            {/* Header */}
            <header className={`flex shrink-0 items-center gap-3 ${GRADIENT} px-4 py-3.5 text-white`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-frank-ruhl text-[18px] font-semibold leading-tight">Cuisine AI</p>
                <p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap font-sora text-[11px] leading-none text-white/85">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#B6FFB0]" aria-hidden="true" />
                  <span className="truncate">Food assistant · English & বাংলা</span>
                </p>
              </div>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={resetChat}
                  aria-label="Start a new chat"
                  title="New chat"
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15 focus:outline-none focus-visible:[outline:2px_solid_white]"
                >
                  <RotateCcw className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15 focus:outline-none focus-visible:[outline:2px_solid_white]"
              >
                <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </button>
            </header>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#F9F6F3] px-4 py-4" aria-live="polite">
              {messages.length === 0 ? (
                <Welcome lang={starterLang} onPick={send} />
              ) : (
                <ul className="flex flex-col gap-4">
                  {messages.map((message) => (
                    <li key={message.id}>
                      {message.role === "user" ? (
                        <div className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-[18px] rounded-br-[6px] bg-black px-3.5 py-2.5 font-sora text-[13px] leading-[1.55] text-white">
                          {message.content}
                        </div>
                      ) : (
                        <AssistantBubble
                          message={message}
                          onAdd={handleAdd}
                          onRetry={() => {
                            const lastUser = [...messages].reverse().find((m) => m.role === "user");
                            if (lastUser) {
                              setMessages((prev) => prev.filter((m) => m.id !== message.id && m.id !== lastUser.id));
                              void send(lastUser.content);
                            }
                          }}
                        />
                      )}
                    </li>
                  ))}
                  {sending && (
                    <li>
                      <div className="flex w-fit items-center gap-1 rounded-[18px] rounded-bl-[6px] bg-white px-4 py-3.5" aria-label="Cuisine AI is typing">
                        {[0, 1, 2].map((dot) => (
                          <span
                            key={dot}
                            className="h-2 w-2 animate-bounce rounded-full bg-[#FF9540]"
                            style={{ animationDelay: `${dot * 0.15}s` }}
                          />
                        ))}
                      </div>
                    </li>
                  )}
                </ul>
              )}

              {!sending && lastAssistant?.suggestions && lastAssistant.suggestions.length > 0 && messages[messages.length - 1] === lastAssistant && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {lastAssistant.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => send(suggestion)}
                      className="rounded-full border border-[#FF9540]/40 bg-white px-3 py-1.5 font-sora text-[12px] leading-none text-[#E0661B] transition-colors hover:bg-[#FFF1E5]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <form
              className="shrink-0 border-t border-black/5 bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
            >
              <div className="flex items-end gap-2 rounded-[20px] bg-[#F9F6F3] p-1.5 pl-3.5 focus-within:[outline:2px_solid_#FF9540] focus-within:[outline-offset:-2px]">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value.slice(0, MAX_INPUT))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      void send(input);
                    }
                  }}
                  rows={1}
                  placeholder={preferBangla ? "খাবার, অফার বা অর্ডার নিয়ে জিজ্ঞেস করুন…" : "Ask about dishes, offers or your order…"}
                  aria-label="Message Cuisine AI"
                  className="max-h-28 min-h-[36px] flex-1 resize-none bg-transparent py-2 font-sora text-[16px] leading-[1.4] text-black placeholder:text-[13px] placeholder:text-black/45 focus:outline-none min-[640px]:text-[13px]"
                  style={{ fieldSizing: "content" } as React.CSSProperties}
                />
                {speechSupported && (
                  // Which language the mic listens for. It follows what the
                  // customer last typed, but they can switch it here — a
                  // Bangla listener hears English speech as nothing at all.
                  <button
                    type="button"
                    onClick={() => setPreferBangla((prev) => !prev)}
                    disabled={listening}
                    aria-label={preferBangla ? "Voice language: Bangla. Switch to English" : "Voice language: English. Switch to Bangla"}
                    title={preferBangla ? "Voice: বাংলা (tap for English)" : "Voice: English (tap for বাংলা)"}
                    className="flex h-9 shrink-0 items-center justify-center rounded-full px-1.5 font-sora text-[11px] font-semibold text-black/55 transition-colors hover:bg-black/[0.06] disabled:opacity-40"
                  >
                    {preferBangla ? "বাং" : "EN"}
                  </button>
                )}
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleVoice}
                    aria-label={listening ? "Stop listening" : "Speak your question"}
                    title={preferBangla ? "বাংলায় বলুন" : "Speak (English)"}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                      listening ? "bg-[#D72A37] text-white" : "text-black/60 hover:bg-black/[0.06]"
                    }`}
                  >
                    {listening ? (
                      <MicOff className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
                    ) : (
                      <Mic className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
                    )}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  aria-label="Send"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${GRADIENT} text-white transition-opacity disabled:opacity-40`}
                >
                  <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
              <p className="mt-2 text-center font-sora text-[10px] leading-[1.4] text-black/40">
                AI can make mistakes. For allergies, please confirm with our staff.
              </p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function Welcome({ lang, onPick }: { lang: "en" | "bn"; onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[18px] rounded-bl-[6px] bg-white p-4">
        <p className="font-frank-ruhl text-[17px] font-semibold leading-tight text-black">
          {lang === "bn" ? "হ্যালো! 👋 আমি Cuisine AI" : "Hi there! 👋 I'm Cuisine AI"}
        </p>
        <p className="mt-1.5 font-sora text-[13px] leading-[1.6] text-black/70">
          {lang === "bn"
            ? "কী খাবেন ঠিক করতে পারছেন না? স্বাদ, বাজেট বা ডায়েট বলুন — মেনু থেকে সাজিয়ে দেব। অফার, পয়েন্ট আর অর্ডারের খবরও জানাতে পারি।"
            : "Not sure what to eat? Tell me your mood, budget or diet and I'll pick from our menu. I can also find offers, check your points and track your order."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {STARTERS.map((starter) => (
          <button
            key={starter.en}
            type="button"
            onClick={() => onPick(starter[lang])}
            className="rounded-full border border-black/10 bg-white px-3 py-2 font-sora text-[12px] leading-none text-black transition-colors hover:border-[#FF9540] hover:text-[#E0661B]"
          >
            {starter[lang]}
          </button>
        ))}
      </div>
    </div>
  );
}

function AssistantBubble({
  message,
  onAdd,
  onRetry,
}: {
  message: UiMessage;
  onAdd: (dish: AssistantDish) => void;
  onRetry: () => void;
}) {
  return (
    <div className="flex max-w-full flex-col gap-2.5">
      <div
        className={`w-fit max-w-[90%] whitespace-pre-wrap break-words rounded-[18px] rounded-bl-[6px] px-3.5 py-2.5 font-sora text-[13px] leading-[1.6] ${
          message.failed ? "bg-red-50 text-red-600" : "bg-white text-black"
        }`}
      >
        {message.content}
        {message.failed && (
          <button type="button" onClick={onRetry} className="ml-2 font-semibold underline">
            Try again
          </button>
        )}
      </div>

      {message.dishes && message.dishes.length > 0 && (
        // A 2-column grid, not a sideways scroller — every card is fully
        // visible whatever the panel width (400px desktop, 320px phone).
        <div className="grid grid-cols-2 gap-2.5">
          {message.dishes.map((dish) => (
            <DishCard key={dish.id} dish={dish} kitchenOpen={message.kitchenOpen !== false} onAdd={onAdd} />
          ))}
        </div>
      )}

      {message.orders && message.orders.length > 0 && (
        <div className="flex flex-col gap-2">
          {message.orders.map((order) => (
            <Link
              key={order.href}
              href={order.href}
              className="flex items-center gap-3 rounded-[16px] bg-white p-3 transition-colors hover:bg-[#FFF8F2]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF1E5] text-[#FF7100]">
                <UtensilsCrossed className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-sora text-[12px] font-semibold text-black">{order.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-sora text-[10px] font-semibold ${
                      /delivered/i.test(order.status)
                        ? "bg-[#E8FFEC] text-[#0E9F00]"
                        : /cancel/i.test(order.status)
                          ? "bg-[#FAE7EC] text-[#D72A37]"
                          : /way|ready/i.test(order.status)
                            ? "bg-[#FDE7F3] text-[#C2258A]"
                            : "bg-[#FFF1E5] text-[#FF7100]"
                    }`}
                  >
                    {order.status}
                  </span>
                </span>
                <span className="block truncate font-sora text-[11px] text-black/60">{order.items}</span>
                <span className="block font-sora text-[11px] text-black/45">
                  {order.placedAt} · {order.total}
                </span>
              </span>
              <span className="shrink-0 font-sora text-[12px] font-semibold text-[#E0661B]">{/delivered|cancel/i.test(order.status) ? "View →" : "Track →"}</span>
            </Link>
          ))}
        </div>
      )}

      {message.source === "basic" && !message.failed && (
        <p className="font-sora text-[10px] text-black/40">Quick answer — our AI is busy right now.</p>
      )}
    </div>
  );
}

function DishCard({
  dish,
  kitchenOpen,
  onAdd,
}: {
  dish: AssistantDish;
  kitchenOpen: boolean;
  onAdd: (dish: AssistantDish) => void;
}) {
  return (
    // `@container` — the card lays itself out by its OWN width (≈135px on
    // a 320px phone, ≈180px on desktop), so nothing is ever cut off.
    <article className="@container flex min-w-0 flex-col overflow-hidden rounded-[16px] bg-white">
      <Link href={`/menu/${dish.id}`} className="relative block aspect-[4/3] w-full bg-[#F3EEE9]">
        {dish.imageUrl ? (
          <Image src={dish.imageUrl} alt={dish.title} fill unoptimized sizes="200px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-black/25">
            <UtensilsCrossed className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
          </span>
        )}
        {dish.badge && (
          <span
            className={`absolute left-1.5 top-1.5 max-w-[calc(100%-12px)] truncate rounded-full ${GRADIENT} px-2 py-0.5 font-sora text-[10px] font-semibold text-white`}
          >
            {dish.badge}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <Link
          href={`/menu/${dish.id}`}
          className="line-clamp-2 break-words font-frank-ruhl text-[13px] font-semibold leading-tight text-black hover:underline @[160px]:text-[14px]"
        >
          {dish.title}
        </Link>
        {(dish.rating !== null && dish.reviewCount > 0) || dish.prepTimeMinutes || dish.foodStatus ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-sora text-[10px] text-black/50">
            {dish.rating !== null && dish.reviewCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-[#FFB400] text-[#FFB400]" aria-hidden="true" />
                {dish.rating.toFixed(1)}
              </span>
            )}
            {dish.prepTimeMinutes ? (
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {dish.prepTimeMinutes} min
              </span>
            ) : null}
            {dish.foodStatus && <span className="max-w-full truncate">{dish.foodStatus}</span>}
          </p>
        ) : null}
        {/* Price and button share a row when there's room, and the button
            drops below the price when there isn't (long currency labels
            like "BDT 1,250.00"). */}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-1.5 gap-y-1.5 pt-1">
          <span className="min-w-0">
            <span className="block whitespace-nowrap font-sora text-[12px] font-semibold text-black @[160px]:text-[13px]">
              {dish.priceLabel}
            </span>
            {dish.oldPriceLabel && (
              <span className="block whitespace-nowrap font-sora text-[10px] text-black/40 line-through">
                {dish.oldPriceLabel}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => onAdd(dish)}
            disabled={!kitchenOpen}
            title={kitchenOpen ? "Add to cart" : "Kitchen is closed"}
            aria-label={kitchenOpen ? `Add ${dish.title} to cart` : "Kitchen is closed"}
            className={`ml-auto flex h-8 shrink-0 items-center gap-1 rounded-full ${GRADIENT} px-2.5 font-sora text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40`}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
            {kitchenOpen ? "Add" : "Closed"}
          </button>
        </div>
      </div>
    </article>
  );
}
