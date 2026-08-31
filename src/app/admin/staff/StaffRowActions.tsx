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
    <div className="flex shrink-0 items-center gap-2.5">
      {canEdit && (
        /* Figma: Hug ×36, radius 100, padding 10×16, পাড় 1px #000000,
           BG স্বচ্ছ, লেখা Sora 500 14px #000000। */
        <Link
          href={`/admin/staff/${userId}`}
          aria-label={`Edit ${name}`}
          className="flex h-9 items-center justify-center rounded-full border border-black px-4 font-sora text-[14px] font-medium leading-none text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
        >
          Edit
        </Link>
      )}

      {/* Figma: একই মাপ, কিন্তু পাড় নেই — কমলা→গোলাপি gradient, সাদা লেখা।
          Gradient-টা প্রজেক্টের নিজের (AdminNavRail-এর active item,
          BusinessSummaryCard, auth পাতার primary বোতাম — সবখানে
          #FF9540 → #FF70C6), নতুন কোনো রঙ যোগ করা হয়নি। */}
      <Link
        href={`/admin/staff/${userId}/view`}
        aria-label={`View ${name}`}
        className="flex h-9 items-center justify-center rounded-full bg-gradient-to-r from-[#FF9540] to-[#FF70C6] px-4 font-sora text-[14px] font-medium leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
      >
        View
      </Link>
    </div>
  );
}
