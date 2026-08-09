/**
 * src/instrumentation-client.ts
 *
 * Sentry browser SDK init. Runs before the app becomes interactive.
 * No-ops safely when NEXT_PUBLIC_SENTRY_DSN isn't set (local dev, or any
 * environment that hasn't been given a DSN yet) — Sentry.init() with an
 * empty/undefined dsn just skips sending events instead of throwing, so
 * this file is safe to ship even before a Sentry project exists.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Keep this modest — this app doesn't need per-click tracing volume,
  // and a low rate still surfaces slow-page patterns without ballooning
  // event quota on the free/starter Sentry tier.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // Session Replay is deliberately NOT enabled (no replayIntegration is
  // registered above) — it captures DOM content, which on a checkout and
  // admin app means real customer names, addresses, and order data
  // flowing to a third party. Turn it on deliberately, with PII masking
  // configured, if that trade-off is ever wanted — never by default.
  enabled: process.env.NODE_ENV === "production",
});

/**
 * Next.js calls this on every client-side route change. Without it the
 * SDK only ever sees the first page load, so an error thrown while
 * navigating from /carts to /track/[orderId] arrives with no trace of
 * which navigation caused it — which is exactly the case you most want
 * context for. The build warns about this ("ACTION REQUIRED") rather
 * than failing, so it's easy to ship without noticing.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;