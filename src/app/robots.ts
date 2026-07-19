import type { MetadataRoute } from "next";

/**
 * src/app/robots.ts
 *
 * Next's file-convention route — this generates /robots.txt automatically
 * at build/request time. No sitemap.ts existed before this either (see
 * src/app/sitemap.ts), so search engines had no crawl guidance and no
 * discovery path for this site's pages at all.
 *
 * Disallowed paths are either private (/admin, /account, /carts — a
 * logged-in-or-guest customer's own data, no SEO value) or personalized/
 * dynamic (/track/[orderId], /order, /table, /dine-in — order-flow and
 * QR-table pages a search engine indexing wouldn't help anyone find via
 * a Google search anyway).
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/account",
        "/carts",
        "/api",
        "/track",
        "/order",
        "/table",
        "/dine-in",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
