/**
 * src/lib/menu-image.ts
 *
 * মেনুর ছবি optimizer দিয়ে ছোট করে দেওয়া যাবে কিনা — তার সিদ্ধান্ত।
 *
 * ── কেন ───────────────────────────────────────────────────────────────
 * আগে প্রতিটা ছবিতে `unoptimized` ছিল, মানে ব্রাউজার প্রতিটা কার্ডের জন্য
 * আসল ফাইলটা (১০০–২০০KB) নামাত — অথচ কার্ডে দেখায় ৩৯২px চওড়া জায়গায়।
 * /menu-তে ১৮+ কার্ড মানে কয়েক MB, আর প্রতিটা বড় ছবি decode করার কাজটাও
 * main thread-এ — স্ক্রল ঝাঁকুনির বড় কারণ। optimizer দিলে ছবি আসে ওই
 * মাপের WebP হয়ে, সাধারণত ১৫–৩০KB।
 *
 * ── কেন সব ছবিতে নয় ────────────────────────────────────────────────
 * `unoptimized` আসলে একটা সুরক্ষা ছিল (FoodCard-এর পুরনো comment দ্রষ্টব্য):
 * next.config.ts-এর `remotePatterns`-এ না থাকা host-এর ছবি optimizer-এ
 * গেলে 400 দিয়ে ভাঙে। তাই এখানে **ঠিক ওই remotePatterns-এর প্রতিলিপি**
 * দিয়ে যাচাই করা হয়: তালিকায় থাকলে optimizer, না থাকলে আগের মতো
 * `unoptimized` — অর্থাৎ কোনো ছবি ভাঙার ঝুঁকি নেই।
 *
 * ⚠️ next.config.ts-এর `remotePatterns` বদলালে এখানেও বদলাতে হবে।
 */

const CLOUDINARY_HOST = "res.cloudinary.com";
// next.config.ts-এর `/dxohwanal/**` আর `/dzi3u164c/**`।
const CLOUDINARY_PATH_PREFIXES = ["/dxohwanal/", "/dzi3u164c/"];

// `NEXT_PUBLIC_` — browser bundle-এও build-এর সময় বসে যায়, তাই client
// component থেকেও এটা পড়া যায়।
function supabaseHostname(): string | null {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!origin) return null;
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

export function canOptimizeImage(src: string): boolean {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    // সম্পর্কিত path (`/foo.png`) — নিজের public/ থেকে, optimizer-এ নিরাপদ।
    return src.startsWith("/");
  }
  if (url.protocol !== "https:") return false;

  if (url.hostname === CLOUDINARY_HOST) {
    return CLOUDINARY_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  }

  const supabase = supabaseHostname();
  if (supabase && url.hostname === supabase) {
    return url.pathname.startsWith("/storage/v1/object/public/");
  }

  return false;
}

/** `<Image {...menuImageProps(src)} />` — optimizer চলবে কিনা সেটাই একমাত্র prop। */
export function menuImageProps(src: string): { unoptimized: boolean } {
  return { unoptimized: !canOptimizeImage(src) };
}