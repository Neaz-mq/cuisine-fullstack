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
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    // Figma Frame 2147236290: column, gap 12, উচ্চতা 42।
    <div className="flex min-w-0 flex-col gap-3 xl:flex-1">
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
        // Figma "Status" pill: padding 10×6-এর কাছাকাছি, radius 100,
        // Active সবুজ (BG #E7F6EC / টেক্সট #1E8E3E গড়নের), Inactive
        // লাল। প্রজেক্টের বাকি জায়গার badge রঙের সাথে মিলিয়ে (dashboard
        // status badge দ্রষ্টব্য) হুবহু hex না বসিয়ে Tailwind-এর
        // green/red-100-700 জোড়া ব্যবহার করা হলো — নতুন কোনো custom
        // রঙ যোগ না করে যা আছে তার সাথে সামঞ্জস্য রাখতে।
        <span
          className={`inline-flex w-fit items-center rounded-full px-3 py-1 font-sora text-[13px] font-medium leading-none xl:text-[14px] ${
            tone === "positive" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
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

