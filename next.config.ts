import type { NextConfig } from "next";

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

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  // 'data:' covers the QR codes generated client-side by the `qrcode`
  // package (rendered as data:image/png;base64 <img> tags); the Supabase
  // origin covers menu-item photos uploaded via /api/admin/upload-image.
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  `font-src 'self' data:`,
  // Supabase origin for storage uploads/reads, self for the app's own API
  // routes.
  `connect-src 'self' ${supabaseOrigin}`,
  // No site should ever be able to iframe this app (clickjacking).
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
]
  .join("; ")
  // Collapse "img-src 'self' data: blob: " into clean output when
  // supabaseOrigin is empty (e.g. not yet configured locally).
  .replace(/\s+/g, " ");

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
  // injected.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
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

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;