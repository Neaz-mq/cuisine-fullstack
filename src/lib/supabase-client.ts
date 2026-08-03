import { createClient } from "@supabase/supabase-js";

/**
 * src/lib/supabase-client.ts
 *
 * `realtime.transport: WebSocket` is set explicitly below to work around
 * a known Next.js + Turbopack dev-mode issue: @supabase/realtime-js tries
 * to auto-detect a native WebSocket implementation at runtime (checking
 * `typeof WebSocket !== "undefined"` internally), and Turbopack's module
 * wrapping breaks that check even though the browser's real WebSocket is
 * available — the client then throws "WebSocket not available" the
 * moment anything calls .subscribe() (see ChatPanel.tsx). Passing the
 * browser's WebSocket in directly skips that broken detection entirely.
 *
 * `typeof WebSocket !== "undefined" ? WebSocket : undefined` keeps this
 * file safe to import from code that might ever run on the server (where
 * there's no global WebSocket) — it only forces the browser
 * implementation when one actually exists.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    realtime: {
      transport: typeof WebSocket !== "undefined" ? WebSocket : undefined,
    },
  }
);