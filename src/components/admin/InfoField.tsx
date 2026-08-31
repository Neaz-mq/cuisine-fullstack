/**
 * src/components/admin/InfoField.tsx
 *
 * সারির একটা মাঠ — উপরে শিরোনাম, নিচে মান। আগে admin/users/page.tsx-এ
 * `Field` নামে local ছিল। admin/staff-এর নতুন redesign-এও (Join Date,
 * Phone Number, Role, Shift, Status) হুবহু একই গড়ন লাগে — পাঁচটা মাঠ,
 * একই grid, একই label/value typography — তাই StaffOverviewCards/
 * UserAvatar-এর একই যুক্তিতে এখানে বের করা।
 *
 * Figma: শিরোনাম Sora 400 14px Black/70, মান Frank Ruhl 500 16px
 * #000000, মাঝে 8px।
 *
 * ⚠️ `tone` — Users page-এর কোনো field-এই দরকার হয়নি, কিন্তু Staff
 * page-এর "Status" মাঠটা Figma-তে রঙিন pill (Active সবুজ, Inactive
 * লাল), সাদাসিধা লেখা নয়। প্রতিটা caller-এর জন্য আলাদা component
 * বানানোর বদলে একটা ঐচ্ছিক prop — না দিলে আগের মতোই plain লেখা, তাই
 * Users page-এর পাঁচটা ব্যবহারই অপরিবর্তিত থাকে।
 */
export default function InfoField({
  label,
  value,
  tone,
  className = "xl:flex-1",
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  /**
   * xl-এ এই মাঠটা কতটা জায়গা নেবে।
   *
   * ⚠️ ডিফল্ট `xl:flex-1` — অর্থাৎ সব মাঠ সমান, আর Users page-এর
   * পাঁচটা ব্যবহার আগের মতোই থাকে।
   *
   * কিন্তু Figma-তে মাঠগুলো সমান নয়, আর সমান করলে সারিটা ভুল দেখায়:
   * designer "Role"-কে ৬৪px আর "Shift"-কে ১৪২px দিয়েছেন, কারণ
   * "Manager" ছোট আর "Evening (02-10 PM)" বড়। সমান ভাগ করলে Role-এর
   * চারপাশে বিরাট ফাঁক পড়ে আর Shift কেটে যায়। তাই Staff page প্রতিটা
   * মাঠে Figma-র প্রস্থটাই flex-grow হিসেবে পাঠায়
   * (`xl:flex-[142_1_auto]`), স্থির px নয় — বিস্তারিত ব্যাখ্যা
   * admin/staff/page.tsx-এ সেই তালিকাটার পাশে।
   */
  className?: string;
}) {
  return (
    // Figma Frame 2147236290: column, gap 12, উচ্চতা 42।
    <div className={`flex min-w-0 flex-col gap-3 ${className}`}>
      {/**
       * Figma: Sora 400, 14px, LH 100%, Black/70।
       *
       * ⚠️ xl-এ `whitespace-nowrap`, truncate নয় — Users page-এ আগে
       * "Customer Category" কেটে গিয়ে "Customer Catego…" দেখাচ্ছিল।
       *
       * কারণটা জায়গার অভাব ছিল না, হিসাবের: Figma-তে মাঠগুলোর জন্য
       * বরাদ্দ ৭৩৪px, চারটে ৩০px gap বাদ দিলে পাঁচ ভাগে ~১২৩px করে।
       * "Customer Category" (Users page-এর সবচেয়ে চওড়া label) ১৪px
       * Sora-তে ~১২৫px — অর্থাৎ শিরোনামটাই সবচেয়ে চওড়া, আর ওটাই
       * কলামের প্রস্থ ঠিক করার কথা। truncate সেটা হতে দিচ্ছিল না, সে
       * বরং চুপচাপ কেটে দিচ্ছিল। Staff page-এর label-গুলো ("Phone
       * Number" সবচেয়ে চওড়া) এর চেয়ে ছোট, তাই একই নিয়ম নিরাপদেই খাটে।
       *
       * xl-এর নিচে wrap করতে দেওয়া হয়, কারণ সেখানে সারি ভেঙে
       * দুই/তিন কলামের grid হয়ে যায় আর প্রস্থ অনেক কম।
       */}
      <p className="font-sora text-[13px] font-normal leading-none text-black/70 xl:whitespace-nowrap xl:text-[14px]">
        {label}
      </p>
      {tone ? (
        /**
         * Figma "Status" pill: উচ্চতা 36, padding 12, radius 100,
         * লেখা Sora 400 12px।
         *
         * ⚠️ রঙগুলো Figma-র নিজের hex, Tailwind-এর green/red-100-700
         * জোড়া নয়। আগে ওই জোড়াই ব্যবহার হচ্ছিল ("নতুন custom রঙ যোগ
         * করব না" যুক্তিতে), কিন্তু পাশাপাশি রাখলে পার্থক্যটা স্পষ্ট:
         * Tailwind-এর green-100 (#DCFCE7) ঘোলাটে আর green-700
         * (#15803D) গাঢ়-বনজ, অথচ নকশার সবুজটা প্রায় সাদা পটভূমিতে
         * উজ্জ্বল #0ECF00। cream সারির উপরে বসলে দুটো একেবারেই আলাদা
         * দেখায়। এগুলো designer-এর বেছে দেওয়া badge রঙ, তাই এখানে
         * সেগুলোই।
         */
        <span
          className={`inline-flex h-9 w-fit items-center rounded-full px-3 font-sora text-[12px] font-normal leading-none ${
            tone === "positive" ? "bg-[#E8FFEC] text-[#0ECF00]" : "bg-[#FAE7EC] text-[#D72A37]"
          }`}
        >
          {value}
        </span>
      ) : (
        // Figma: Frank Ruhl Libre 500, 16px, LH 100%, #000000।
        <p className="truncate font-frank-ruhl text-[15px] font-medium leading-none text-black xl:text-[16px]">
          {value}
        </p>
      )}
    </div>
  );
}

