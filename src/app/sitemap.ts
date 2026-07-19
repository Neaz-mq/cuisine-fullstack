import type { MetadataRoute } from "next";

/**
 * src/app/sitemap.ts
 *
 * Next's file-convention route — generates /sitemap.xml automatically.
 * Deliberately only lists public, non-personalized, non-authenticated
 * pages: the marketing homepage, the menu, the chefs page, and gift
 * cards. Login/register, account/order pages, the QR table-ordering
 * flow, and everything under /admin are excluded on purpose — see the
 * matching disallow list in robots.ts for why.
 *
 * Static priority/changeFrequency values below are reasonable defaults,
 * not measured — safe to leave as-is, but feel free to tune once there's
 * real traffic data to go on.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const now = new Date();

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/menu`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/chefs`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/gift-cards`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
