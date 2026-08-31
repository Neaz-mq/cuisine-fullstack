import Link from "next/link";

/**
 * src/app/admin/staff/StaffRowActions.tsx
 *
 * Figma-র প্রতিটা staff সারির ডান প্রান্তের দুটো বোতাম: "Edit" (সাদা,
 * কালো পাড়ের pill) আর "View" (কমলা→গোলাপি gradient pill)।
 *
 * ── কেন আগের \"Edit / Deactivate\" লিঙ্ক জোড়া বদলানো হলো ─────────────
 *
 * আগে সারিতে ছিল দুটো সাদামাটা লেখা-লিঙ্ক: Edit আর Deactivate। দুটো
 * সমস্যা ছিল।
 *
 * এক, নকশার সাথে মেলে না — Figma-তে এগুলো বোতাম, লিঙ্ক নয়।
 *
 * দুই, আর এটাই আসল: Deactivate একটা **ধ্বংসাত্মক** কাজ, অথচ সেটা বসে
 * ছিল Edit-এর ঠিক পাশে, প্রতিটা সারিতে, তালিকার ভেতরেই। ভুল সারিতে
 * click করলে ভুল লোকের login বন্ধ হয়ে যেত — `confirm()` ছাড়া আর কোনো
 * বাধা ছিল না, আর confirm dialog মানুষ পড়ে না। তাই Deactivate এখন
 * সারিতে নেই; সেটা সরে গেছে View পাতার ভেতরে (staff/[id]/view), যেখানে
 * পৌঁছতে হলে আগে ওই নির্দিষ্ট কর্মীর পাতাটা খুলতে হয় — অর্থাৎ কাকে
 * নিষ্ক্রিয় করা হচ্ছে সেটা চোখের সামনে থাকে।
 *
 * ── canEdit ───────────────────────────────────────────────────────────
 *
 * MANAGER একজন OWNER-কে তালিকায় দেখতে পান, কিন্তু তাঁর edit পাতা
 * খুললে সেটা notFound() দেয় (staff/[id]/page.tsx-এর canManageStaffRole
 * গার্ড)। তাই বোতামটাই দেখানো হয় না — নাহলে বোতাম দেখা যেত, চাপলে
 * 404। View কিন্তু সবার জন্যই খোলা: দেখা আর বদলানো এক নয়।
 */
export default function StaffRowActions({
  userId,
  name,
  canEdit,
}: {
  userId: string;
  /** aria-label-এর জন্য — সারিতে দশটা "Edit" থাকলে screen reader
   *  ব্যবহারকারী কোনটা কার তা আলাদা করতে পারতেন না। */
  name: string;
  canEdit: boolean;
}) {
  return (
    /* Figma Frame 2147236374: row, justify flex-end, gap 8, উচ্চতা 40। */
    <div className="flex shrink-0 items-center justify-end gap-2">
      {canEdit && (
        /* Figma: 53×40, radius 100, padding 13px 12px, পাড় 1px #000000,
           BG স্বচ্ছ, লেখা Sora 400 14px #000000।

           ⚠️ font-medium নয়, font-normal — Figma-র দুটো বোতামের লেখাই
           Sora 400। medium-এ বোতামজোড়া সারির নাম-লেখার (Frank Ruhl 500)
           সাথে ওজনে প্রতিযোগিতা করছিল। */
        <Link
          href={`/admin/staff/${userId}`}
          aria-label={`Edit ${name}`}
          className="flex h-10 items-center justify-center rounded-full border border-black px-3 font-sora text-[14px] font-normal leading-none text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
        >
          Edit
        </Link>
      )}

      {/**
       * Figma: 59×40, পাড় নেই, সাদা লেখা,
       * `linear-gradient(93.36deg, #FF9540 0%, #FF70C6 145.78%)`।
       *
       * ⚠️ `bg-gradient-to-r` দিয়ে এটা হয় না, আর পার্থক্যটা চোখে পড়ে।
       * ওই utility মানে ঠিক 90deg আর দ্বিতীয় রঙটা 100%-এ — অর্থাৎ
       * বোতামের ডান কিনারাতেই পুরো গোলাপি। Figma-তে গোলাপিটা 145.78%-এ,
       * অর্থাৎ বোতামের **বাইরে**; ভেতরে যেটুকু দেখা যায় সেটা কমলা থেকে
       * একটা নরম মাঝামাঝি রঙ পর্যন্ত। তাই utility ব্যবহার করলে বোতামটা
       * নকশার চেয়ে অনেক বেশি গোলাপি দেখাত (আপনার screenshot-এ ঠিক
       * সেটাই হচ্ছিল)। কোণটাও 93.36deg — সামান্য হেলানো।
       */}
      <Link
        href={`/admin/staff/${userId}/view`}
        aria-label={`View ${name}`}
        className="flex h-10 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-3 font-sora text-[14px] font-normal leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
      >
        View
      </Link>
    </div>
  );
}
