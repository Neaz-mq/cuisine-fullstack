/**
 * src/instrumentation.ts
 *
 * Next.js calls register() once per server instance, before it starts
 * handling requests. NEXT_RUNTIME tells us which of the two non-browser
 * runtimes we're in, so we load the matching Sentry config — the Node
 * config imports things (like Node's `http` internals) that don't exist
 * on the edge runtime, so the split is required, not just tidy.
 */
import * as Sentry from "@sentry/nextjs";

/**
 * Without this export, errors that Next.js itself catches — an uncaught
 * throw in a route handler, server component or server action — never reach
 * Sentry. The init files only set the SDK up; this is the hook Next calls
 * for each request error.
 */
export const onRequestError = Sentry.captureRequestError;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");

    // Put this server's clock on the restaurant's time zone before any
    // request is handled (Vercel runs in UTC — see lib/server-timezone.ts).
    // The default applies at once; the saved Settings value follows as
    // soon as the database answers. Not awaited, so a slow or missing
    // database never delays start-up.
    const { applyServerTimezone, DEFAULT_TIMEZONE } = await import("./lib/server-timezone");
    applyServerTimezone(DEFAULT_TIMEZONE);
    import("./lib/get-settings")
      .then(({ getRestaurantSettings }) => getRestaurantSettings())
      .catch(() => {
        // No database (e.g. during a build) — the default stays in place.
      });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}