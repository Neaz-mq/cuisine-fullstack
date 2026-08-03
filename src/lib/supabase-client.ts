import { createClient } from "@supabase/supabase-js";

/**
 * src/lib/supabase-client.ts
 *
 * Standard browser client — no custom `realtime.transport` override.
 * Browsers always have a native `WebSocket` global, so realtime-js's
 * auto-detection works out of the box here. (A manual transport override
 * is only ever needed when running this client in Node.js < 22 on the
 * server, which this app doesn't do — this client is browser-only.)
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);