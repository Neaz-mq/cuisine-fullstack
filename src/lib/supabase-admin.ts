import { createClient } from "@supabase/supabase-js";

/**
 * এই client শুধুমাত্র server-side (API routes) থেকে ব্যবহার হওয়া উচিত —
 * secret key Row Level Security bypass করে, তাই এটা client-side-এ
 * কখনো expose করা যাবে না।
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);