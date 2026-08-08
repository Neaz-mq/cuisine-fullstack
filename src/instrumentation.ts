/**
 * src/instrumentation.ts
 *
 * Next.js calls register() once per server instance, before it starts
 * handling requests. NEXT_RUNTIME tells us which of the two non-browser
 * runtimes we're in, so we load the matching Sentry config — the Node
 * config imports things (like Node's `http` internals) that don't exist
 * on the edge runtime, so the split is required, not just tidy.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}