"use client";

import { useState } from "react";
import StaffFormModal from "./StaffFormModal";
import ViewStaffModal from "./ViewStaffModal";

/**
 * src/app/admin/staff/StaffRowActions.tsx
 *
 * Figma-র প্রতিটা staff সারির ডান প্রান্তের দুটো বোতাম: "Edit" (সাদা,
 * কালো পাড়ের pill) আর "View" (কমলা→গোলাপি gradient pill)।
 *
 * ── কেন এগুলো <Link> নয়, <button> ───────────────────────────────────
 *
 * আগে দুটোই আলাদা পাতায় নিয়ে যেত: /admin/staff/[id] আর
 * /admin/staff/[id]/view। কাজ করত, কিন্তু প্রতিবার তালিকা থেকে বেরিয়ে
 * যেতে হতো — দশজনের তথ্য দেখতে দশবার পাতা বদল, প্রতিবার ফিরে এসে
 * ছাঁকনি আর page নম্বর আবার খুঁজে নেওয়া। আর edit পাতাটা দেখতেও ছিল
 * সম্পূর্ণ আলাদা (সাদা বাক্স, চৌকো কোণ, native select) — অর্থাৎ
 * "যোগ করা" সুন্দর modal-এ, "সম্পাদনা" অন্য দশকের একটা form-এ।
 *
 * এখন দুটোই modal, একই খোলস (staff-modal-ui.tsx), আর পেছনের তালিকাটা
 * যেখানে ছিল সেখানেই থাকে।
 *
 * ⚠️ /admin/staff/[id] আর /admin/staff/[id]/view পাতা দুটো এখন আর
 * কোথাও থেকে খোলে না। ফোল্ডারগুলো মুছে ফেলা যায়।
 *
 * ── Deactivate কোথায় গেল ────────────────────────────────────────────
 *
 * সারিতে আগে "Edit / Deactivate" জোড়া ছিল। Deactivate একটা
 * **ধ্বংসাত্মক** কাজ, অথচ সেটা বসে ছিল প্রতিটা সারিতে, তালিকার
 * ভেতরেই — ভুল সারিতে click করলে ভুল লোকের login বন্ধ হয়ে যেত।
 * সেটা এখন View modal-এর footer-এ, যেখানে পৌঁছতে হলে আগে ওই
 * নির্দিষ্ট কর্মীর তথ্যটা চোখের সামনে আসে।
 *
 * ── canEdit ───────────────────────────────────────────────────────────
 *
 * MANAGER একজন OWNER-কে তালিকায় দেখতে পান, কিন্তু PATCH route তাঁকে
 * সম্পাদনা করতে দেয় না (403)। তাই বোতামটাই দেখানো হয় না — নাহলে
 * বোতাম দেখা যেত, চাপলে ব্যর্থ। View কিন্তু সবার জন্যই খোলা: দেখা
 * আর বদলানো এক নয়।
 */
export default function StaffRowActions({
  userId,
  name,
  canEdit,
  isSelf,
  viewerRole,
}: {
  userId: string;
  /** aria-label-এর জন্য — সারিতে দশটা "Edit" থাকলে screen reader
   *  ব্যবহারকারী কোনটা কার তা আলাদা করতে পারতেন না। */
  name: string;
  canEdit: boolean;
  isSelf: boolean;
  viewerRole?: string;
}) {
  const [mode, setMode] = useState<null | "view" | "edit">(null);

  return (
    <>
      {/* Figma Frame 2147236374: row, justify flex-end, gap 8, উচ্চতা 40,
          চওড়া 120।

          ⚠️ xl-এ প্রস্থটা স্থির (১২০), hug নয় — আর এটা সারিবদ্ধতার
          জন্য জরুরি। "Edit" বোতামটা সব সারিতে থাকে না (উপরের canEdit
          দ্রষ্টব্য); hug হলে ওই ব্লকটা সংকুচিত হয়ে যেত আর তার বাঁ
          পাশের পাঁচটা কলাম ডান দিকে সরে যেত। ফলে এক সারির "Shift"
          আরেক সারির "Shift"-এর সাথে মিলত না। */}
      <div className="flex shrink-0 items-center justify-end gap-2 xl:w-[120px]">
        {canEdit && (
          /* Figma: 53×40, radius 100, padding 13px 12px, পাড় 1px
             #000000, BG স্বচ্ছ, লেখা Sora 400 14px #000000। */
          <button
            type="button"
            onClick={() => setMode("edit")}
            aria-label={`Edit ${name}`}
            className="flex h-10 items-center justify-center rounded-full border border-black px-3 font-sora text-[14px] font-normal leading-none text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
          >
            Edit
          </button>
        )}

        {/**
         * Figma: 59×40, পাড় নেই, সাদা লেখা,
         * `linear-gradient(93.36deg, #FF9540 0%, #FF70C6 145.78%)`।
         *
         * ⚠️ `bg-gradient-to-r` দিয়ে এটা হয় না, আর পার্থক্যটা চোখে পড়ে।
         * ওই utility মানে ঠিক 90deg আর দ্বিতীয় রঙটা 100%-এ — অর্থাৎ
         * বোতামের ডান কিনারাতেই পুরো গোলাপি। Figma-তে গোলাপিটা
         * 145.78%-এ, অর্থাৎ বোতামের **বাইরে**; ভেতরে যেটুকু দেখা যায়
         * সেটা কমলা থেকে একটা নরম মাঝামাঝি রঙ পর্যন্ত।
         */}
        <button
          type="button"
          onClick={() => setMode("view")}
          aria-label={`View ${name}`}
          className="flex h-10 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-3 font-sora text-[14px] font-normal leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
        >
          View
        </button>
      </div>

      {/* ⚠️ modal দুটো কেবল দরকার হলে render হয় (`mode === …`), সবসময়
          নয়। তালিকায় দশটা সারি মানে দশ জোড়া modal — সবগুলো mount
          থাকলে প্রতিটা নিজের effect, listener আর state বয়ে বেড়াত।
          `open` prop-টা তবু আছে, কারণ StaffModalShell-এর
          scroll-lock/Escape effect ওটার উপর নির্ভর করে। */}
      {mode === "view" && (
        <ViewStaffModal
          open
          onClose={() => setMode(null)}
          staffId={userId}
          canManage={canEdit}
          isSelf={isSelf}
          // View থেকে সরাসরি Edit-এ — modal বদলায়, কিন্তু তালিকা
          // থেকে বেরোতে হয় না।
          onEdit={() => setMode("edit")}
        />
      )}

      {mode === "edit" && (
        <StaffFormModal
          open
          mode="edit"
          staffId={userId}
          onClose={() => setMode(null)}
          viewerRole={viewerRole}
          isSelf={isSelf}
        />
      )}
    </>
  );
}
