import { UserRound } from "lucide-react";

/**
 * src/components/admin/UserAvatar.tsx
 *
 * সারির ছবি — Figma: 60×60, radius 12, BG #F9F6F3।
 *
 * আগে admin/users/page.tsx-এ inline `Avatar` নামে ছিল। নতুন
 * admin/staff redesign-এর Figma-তেও সারির ছবি হুবহু একই মাপ ও
 * silhouette-fallback ব্যবহার করে (দুটোই User row, কর্মী হোক বা
 * গ্রাহক) — তাই StaffOverviewCards.tsx-এর একই যুক্তিতে এটাও বের করা।
 *
 * Google দিয়ে login করলে তাঁর প্রোফাইল ছবিটা দেখানো হয় (auth.ts-এর
 * signIn callback ওটা User.image-এ রাখে)। ইমেইল-পাসওয়ার্ড দিয়ে তৈরি
 * account-এ কোনো ছবি থাকে না, আর upload করার ব্যবস্থাও নেই — সেখানে
 * একটা নিরপেক্ষ silhouette।
 *
 * ⚠️ next/image নয়, সাধারণ <img>।
 *
 * next/image ব্যবহার করলে next.config-এ lh3.googleusercontent.com-কে
 * remotePatterns-এ যোগ করতে হতো, নাহলে runtime-এ ছবির বদলে error।
 * একটা ৬০px avatar-এ optimization-এর লাভ সামান্য, অথচ config ঠিকমতো
 * না বসলে পুরো পাতাটাই ভেঙে পড়ত। Google-এর CDN এমনিতেও ছোট মাপে
 * ছবি পাঠায়।
 *
 * `referrerPolicy="no-referrer"` — Google মাঝে মাঝে referrer দেখে
 * ছবি আটকে দেয় (403), আর তখন সব সারিতে ভাঙা ছবির চিহ্ন আসত।
 */
export default function UserAvatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name}-এর প্রোফাইল ছবি`}
        width={60}
        height={60}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-[60px] w-[60px] shrink-0 rounded-[12px] object-cover"
      />
    );
  }

  return (
    /**
     * পটভূমি সাদা, #F9F6F3 নয় — যদিও Figma-তে বাক্সটা cream।
     *
     * Figma-তে ওর উপরে সবসময় একটা ছবি বসে, তাই রঙটা কখনো দেখাই
     * যায় না। আমাদের এখানে ছবি না থাকলে সেটাই দেখা যাবে — আর সারির
     * পটভূমিও #F9F6F3 হওয়ায় বাক্সটা একেবারে মিলিয়ে যেত, ফলে
     * silhouette-টা শূন্যে ভাসত। সাদা রাখায় জায়গাটা একটা "খালি
     * ছবির ঘর" বলে বোঝা যায়।
     */
    <span
      aria-hidden="true"
      className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[12px] bg-white"
    >
      <UserRound className="h-8 w-8 text-black/25" fill="currentColor" strokeWidth={1.2} />
    </span>
  );
}
