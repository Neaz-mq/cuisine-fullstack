/**
 * src/sentry.edge.config.ts
 *
 * Sentry Edge runtime init — covers proxy.ts (auth edge middleware), the
 * one piece of this app that runs on Vercel's edge runtime rather than
 * Node. Loaded by instrumentation.ts's register(), not imported directly.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: process.env.NODE_ENV === "production",
});