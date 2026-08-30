import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * next.config.ts
 *
 * Security headers, applied to every response via `headers()`. This runs
 * in Node at build/start time (not the edge/browser), so reading
 * process.env here — e.g. to whitelist the Supabase project's own domain
 * in the CSP — is safe and picks up the right value per environment.
 *
 * The CSP below is deliberately not a strict nonce-based policy: this app
 * has no client-side <script> tags of its own (Stripe is redirect-only
 * checkout, not Stripe Elements; Google Fonts are self-hosted via
 * next/font, not loaded from fonts.googleapis.com at runtime), but
 * Next.js's own hydration/RSC payload relies on inline scripts, so
 * 'unsafe-inline' stays on script-src/style-src to avoid breaking the
 * framework itself. What this CSP DOES lock down, which matters most for
 * an app handling login + payment: no other site can frame this app
 * (clickjacking), and the only things allowed to load as scripts/frames
 * are same-origin. Tightening further to a nonce-based policy is a
 * reasonable follow-up but is a bigger, separate change.
 */
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
// Supabase Realtime (used by ChatPanel.tsx for the live chat feature)
// connects over a WebSocket, i.e. wss://<project>.supabase.co — a
// DIFFERENT scheme from the https:// origin above as far as CSP's
// connect-src matching is concerned. Listing only the https:// origin
// let normal fetch()/storage calls through but silently blocked every
// Realtime WebSocket connection attempt; supabase-js then surfaced that
// as a confusing "WebSocket not available" error instead of a CSP
// violation, which is what actually made this hard to diagnose.
const supabaseWsOrigin = supabaseOrigin.replace(/^https:/, "wss:");

// Sentry's browser SDK reports events to this project's ingest endpoint —
// same CSP gotcha as the Supabase Realtime WSS origin above: without this
// in connect-src, the browser silently drops every event and Sentry just
// looks "empty" instead of erroring, which is much harder to debug than a
// clear CSP violation in devtools. Derived from the DSN so it stays correct
// if the DSN's region/host ever changes, and is simply omitted (matches
// nothing extra) when no DSN is configured yet.
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || "";
const sentryIngestOrigin = sentryDsn ? `https://${new URL(sentryDsn).hostname}` : "";

/**
 * React-এর development build stack reconstruction ও অন্যান্য debugging
 * feature-এর জন্য eval() ব্যবহার করে। 'unsafe-eval' ছাড়া dev-এ Next.js
 * overlay-তে "eval() is not supported in this environment" console error
 * আসে — page কাজ করে, কিন্তু error overlay ঢেকে রাখে আর stack trace
 * ঠিকমতো resolve হয় না।
 *
 * Production-এ এটা কখনোই যোগ হয় না, এবং সেটাই মূল কথা: React-এর
 * production build eval() ব্যবহারই করে না, অথচ 'unsafe-eval' থাকলে
 * injected যেকোনো string executable code হয়ে যায় — অর্থাৎ CSP-র XSS
 * protection-এর মূল উদ্দেশ্যটাই নষ্ট হয়। login + payment handle করা
 * app-এ সেটা মেনে নেওয়ার মতো নয়।
 *
 * Flag-টা এখানে module scope-এ আলাদা করে রাখা হয়েছে যাতে নিচের directive
 * list পড়লেই স্পষ্ট বোঝা যায় এটা conditional — inline ternary-তে লুকিয়ে
 * থাকলে পরে কেউ copy করে production-এও নিয়ে যেতে পারত।
 */
const isDev = process.env.NODE_ENV === "development";

/**
 * Builds one CSP directive from a list of sources, dropping any that are
 * empty. Several origins here are env-derived and legitimately absent in
 * some environments (no Supabase URL locally, no Sentry DSN before a
 * project exists) — joining those in blindly left stray double spaces and
 * a dangling " ;" in the header. Browsers tolerate that, but it makes the
 * emitted policy annoying to read in devtools when something IS blocked,
 * which is exactly when you're looking at it.
 */
const directive = (name: string, ...sources: string[]) =>
  [name, ...sources.filter(Boolean)].join(" ");

const csp = [
  directive("default-src", "'self'"),
  // 'unsafe-eval' শুধু development-এ — উপরে isDev-এর comment দ্রষ্টব্য।
  // Empty string production-এ directive() helper-এর filter(Boolean)-এ
  // বাদ পড়ে যায়, তাই header-এ কোনো stray space থাকে না।
  directive(
    "script-src",
    "'self'",
    "'unsafe-inline'",
    isDev ? "'unsafe-eval'" : ""
  ),
  directive("style-src", "'self'", "'unsafe-inline'"),
  // 'data:' covers the QR codes generated client-side by the `qrcode`
  // package (rendered as data:image/png;base64 <img> tags); the Supabase
  // origin covers menu-item photos uploaded via /api/admin/upload-image;
  // res.cloudinary.com covers marketing/content photos — some are loaded
  // through next/image (proxied same-origin via /_next/image, so CSP
  // wouldn't even see the cross-origin request) but others are still
  // plain <img> tags that hit Cloudinary directly, so it must be listed
  // here explicitly or the browser blocks them outright. This covers both
  // Cloudinary cloud names in use (dxohwanal + dzi3u164c) since img-src is
  // matched by domain only, not by path. tile.openstreetmap.org
  // covers the live delivery map's map tiles (LiveDeliveryMap.tsx) — Leaflet
  // renders tiles as plain <img> tags against OSM's *.tile.openstreetmap.org
  // subdomains (a,b,c load-balanced), so all three need to be allowed.
  directive(
    "img-src",
    "'self'",
    "data:",
    "blob:",
    "https://res.cloudinary.com",
    "https://*.tile.openstreetmap.org",
    // Google account avatars — next-auth-এর Google provider session-এ
    // যে `image` URL দেয় (lh3.googleusercontent.com), admin topbar-এর
    // user menu-তে সেটাই দেখানো হয়। remotePatterns-এ যোগ করাই যথেষ্ট নয়:
    // ওটা না দিলে next/image build-time-এ throw করে, আর এটা না দিলে
    // ছবিটা browser-এ গিয়ে নীরবে block হয় — দ্বিতীয়টা ধরা অনেক কঠিন।
    "https://lh3.googleusercontent.com",
    supabaseOrigin
  ),
  directive("font-src", "'self'", "data:"),
  // Supabase origin for storage uploads/reads and API calls (https), PLUS
  // the wss:// variant for Realtime's WebSocket connection (chat) — see
  // the supabaseWsOrigin comment above for why both are needed. Sentry's
  // ingest origin is included so browser-side error/crash reports aren't
  // silently dropped — see the sentryIngestOrigin comment above.
  directive("connect-src", "'self'", supabaseOrigin, supabaseWsOrigin, sentryIngestOrigin),
  // No site should ever be able to iframe this app (clickjacking).
  directive("frame-ancestors", "'none'"),
  directive("form-action", "'self'"),
  directive("base-uri", "'self'"),
  directive("object-src", "'none'"),
].join("; ");

const securityHeaders = [
  // Blocks this app from being embedded in an <iframe> on another site —
  // the main defense against clickjacking, especially important on
  // login/checkout pages.
  { key: "X-Frame-Options", value: "DENY" },
  // Stops the browser from trying to "guess" a different content-type
  // than what the server declared (MIME-sniffing), which has historically
  // been used to turn an uploaded "image" into executable script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Sends the full URL as a referrer only for same-origin navigations;
  // cross-origin requests get just the origin. Keeps order IDs, session
  // tokens embedded in URLs, etc. from leaking to third-party sites via
  // the Referer header.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Explicitly deny access to sensitive browser APIs this app never
  // needs — narrows the attack surface if a third-party script ever got
  // injected. geolocation is scoped to 'self' (not left at "never") as of
  // the delivery-rider live tracking feature — /admin/my-deliveries needs
  // navigator.geolocation.watchPosition() to share a rider's position;
  // still blocked for any cross-origin/embedded context.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  },
  // Force HTTPS for a year, including subdomains. Harmless locally over
  // HTTP (browsers only honor this over an HTTPS response in the first
  // place), and closes the "first request over HTTP" downgrade window in
  // production.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "Content-Security-Policy", value: csp },
];

// Hostname for the Supabase project, derived the same way as `supabaseOrigin`
// above but split out to a bare hostname for `images.remotePatterns`, which
// needs `protocol`/`hostname` separately rather than a full origin string.
const supabaseHostname = supabaseOrigin
  ? new URL(supabaseOrigin).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Marketing/content images (chef photos, menu banners, etc.) hosted
      // on Cloudinary under this project's original cloud name.
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/dxohwanal/**",
      },
      // Second Cloudinary cloud name — used for design-asset uploads like
      // the register-page hero photo (signup_czzdi1.webp). Same host,
      // different cloud/path prefix, so it needs its own pattern entry:
      // next/image matches remotePatterns by exact pathname prefix, not
      // just by hostname.
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/dzi3u164c/**",
      },
      // Google account avatars from the next-auth Google provider. Scoped
      // to `/a/**` rather than the whole host: every Google profile photo
      // lives under that prefix, so there's no reason to open up the rest
      // of googleusercontent, which also serves arbitrary user uploads
      // from other Google products.
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/a/**",
      },
      // Menu item photos uploaded via /api/admin/upload-image, served back
      // out through Supabase Storage's public URL convention:
      // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<file>
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
  },

  /**
   * ⚠️ Prisma-র query engine binary হাতে ধরে serverless bundle-এ পাঠানো।
   *
   * এটা ছাড়া Vercel-এ build দিব্যি সফল হয়, অথচ প্রতিটা DB query
   * runtime-এ ভেঙে পড়ে:
   *
   *   PrismaClientInitializationError:
   *   Prisma Client could not locate the Query Engine for runtime
   *   "rhel-openssl-3.0.x"
   *
   * কারণটা সূক্ষ্ম। Next.js ঠিক করে কোন ফাইলগুলো function-এ যাবে, আর
   * সেটা করে import-এর শিকড় ধরে ধরে (file tracing)। কিন্তু Prisma-র
   * engine একটা native binary — `libquery_engine-rhel-openssl-3.0.x.so.node`
   * — যেটা কোনো `import` statement-এ নেই, generated client সেটাকে
   * চলার সময় path বানিয়ে খোঁজে। তাই tracer ওটাকে দেখতেই পায় না, আর
   * bundle-এ পাঠায় না।
   *
   * Log-এ পার্থক্যটা স্পষ্ট ছিল:
   *   /vercel/path0/src/generated/prisma  ← build-এ ফাইলটা এখানে ছিল
   *   /var/task/src/generated             ← runtime এখানে খুঁজেছে
   *
   * `output = "../src/generated/prisma"` (schema.prisma) একটা অপ্রচলিত
   * জায়গা বলে সমস্যাটা এখানে নিশ্চিতভাবেই হয় — ডিফল্ট
   * node_modules/.prisma-এ Next.js-এর নিজস্ব বিশেষ ব্যবস্থা আছে,
   * custom output-এ নেই।
   *
   * ⚠️ `experimental`-এর ভেতরে নয়। Next 15 থেকে এটা top-level option;
   * পুরনো টিউটোরিয়াল দেখে `experimental.outputFileTracingIncludes`
   * লিখলে Next সেটা নীরবে অগ্রাহ্য করে আর একই error ফিরে আসে।
   *
   * key `"/**\/*"` মানে প্রতিটা route — শুধু `/api/menu` নয়, কারণ
   * Prisma সব server component আর route handler-এই ব্যবহৃত হয়।
   */
  outputFileTracingIncludes: {
    "/**/*": ["./src/generated/prisma/**/*"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Source map upload needs SENTRY_AUTH_TOKEN, which only exists once a
  // Sentry project is created — omit it locally/pre-launch and this step
  // just no-ops instead of failing the build.
  silent: !process.env.CI,
  // NOTE: `disableLogger` used to be set here. It's deprecated in the
  // current SDK and, more to the point, is a no-op under Turbopack (which
  // this project builds with) — it only ever worked via the webpack
  // plugin. Its replacement is webpack.treeshake.removeDebugLogging,
  // which is likewise webpack-only, so there's nothing to migrate TO
  // here: the option is simply dropped. Sentry's debug logging is
  // stripped in production builds anyway.
});