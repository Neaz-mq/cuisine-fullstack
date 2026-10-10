import sharp from "sharp";

/**
 * src/lib/menu-pdf-photos.ts
 *
 * মেনু PDF-এর জন্য পদের ছবি: URL -> ছোট square JPEG বাইট (বা null)।
 *
 * কেন আলাদা ধাপ লাগে: PDF-এ কেবল JPEG/PNG বসানো যায়, অথচ এই অ্যাপের ছবি
 * তিন রকম — seed করা Cloudinary ছবি (প্রায়ই .webp), আর admin
 * /api/admin/upload-image দিয়ে Supabase-এ তুললে jpg/png/**webp**। তাই
 * সবকিছু `sharp` দিয়ে একই মাপের JPEG-এ নামানো হয়।
 *
 * ⚠️ কেন `/_next/image` দিয়ে নয়: ওখানে Accept header দিয়ে JPEG চাইলে
 * self-hosted Next webp→jpeg করে (পরীক্ষা করে দেখা), কিন্তু Vercel-এর নিজস্ব
 * optimizer-এ সেই আচরণ নিশ্চিত নয় — আর ছবিই এই নকশার মূল আকর্ষণ, চুপচাপ
 * হারিয়ে গেলে ধরা কঠিন। নিজে convert করলে কোনো platform-এর উপর নির্ভর নেই।
 *
 * ⚠️ নিরাপত্তা: imageUrl DB থেকে আসে (admin বসায়), তাই এই server যেকোনো
 * URL টানবে এমনটা হতে দেওয়া যাবে না (SSRF)। কেবল https + allowlist-এর host,
 * redirect বন্ধ, ৫s timeout, ৮MB সীমা। next.config.ts-এর `remotePatterns`-এর
 * সাথে একই দুই host: res.cloudinary.com আর NEXT_PUBLIC_SUPABASE_URL।
 *
 * কোনো ব্যর্থতা (host অচেনা, 404, timeout, ভাঙা ছবি) কখনো throw করে না —
 * null ফেরে, আর PDF ওই শ্রেণির ছবি ছাড়াই আঁকা হয়। একটা ছবির জন্য পুরো
 * মেনু ডাউনলোড বন্ধ হওয়া চলবে না।
 */

const PHOTO_PX = 640; // PDF-এ সর্বোচ্চ ~১৮০pt বৃত্ত — ৩.৫× রেজোলিউশন, ছাপার জন্যও যথেষ্ট
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 5000;

export function allowedPhotoHosts(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const hosts = new Set(["res.cloudinary.com"]);
  try {
    if (env.NEXT_PUBLIC_SUPABASE_URL) hosts.add(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname);
  } catch {
    /* ভুল env মান — Supabase ছবি বাদ, বাকিটা চলবে */
  }
  return hosts;
}

/** Cloudinary হলে server-side-ই ছোট করে JPEG চাওয়া — অকারণে ৫MB-এর মূল ছবি নামে না। */
export function cloudinaryJpg(url: string): string {
  const marker = "/image/upload/";
  const i = url.indexOf(marker);
  if (!url.startsWith("https://res.cloudinary.com/") || i === -1) return url;
  return `${url.slice(0, i + marker.length)}c_fill,g_auto,w_${PHOTO_PX},h_${PHOTO_PX},f_jpg,q_80/${url.slice(i + marker.length)}`;
}

export async function fetchMenuPhoto(
  imageUrl: string | null | undefined,
  { fetchImpl = fetch, env = process.env }: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {}
): Promise<Uint8Array | null> {
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl);
    if (url.protocol !== "https:" || !allowedPhotoHosts(env).has(url.hostname)) return null;

    const response = await fetchImpl(cloudinaryJpg(url.toString()), {
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "image/*" },
    });
    if (!response.ok) return null;

    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) return null;
    const input = Buffer.from(await response.arrayBuffer());
    if (input.length === 0 || input.length > MAX_BYTES) return null;

    const jpeg = await sharp(input, { failOn: "none" })
      .rotate() // EXIF ঘোরানো ফোনের ছবি সোজা করে
      .resize(PHOTO_PX, PHOTO_PX, { fit: "cover", position: "centre" })
      .flatten({ background: "#ffffff" }) // স্বচ্ছ PNG-র কালো হয়ে যাওয়া ঠেকায়
      .jpeg({ quality: 80 })
      .toBuffer();
    return new Uint8Array(jpeg);
  } catch {
    return null;
  }
}
