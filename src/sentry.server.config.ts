/**
 * src/sentry.server.config.ts
 *
 * Sentry Node SDK init — API routes, Server Components/Actions, and
 * anything else running in the Node.js runtime. Loaded by
 * instrumentation.ts's register(), not imported directly anywhere.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: process.env.NODE_ENV === "production",
});