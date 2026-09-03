/**
 * ⚠️ "Pending"-এর জন্য Figma-তে একটা বালুঘড়ি আঁকা, কিন্তু
 * `Hourglass` এই প্রজেক্টে আর কোথাও ব্যবহার হয়নি — অর্থাৎ এই
 * lucide সংস্করণে ওটা আছে কি না যাচাই করা নেই। `AlarmClock` আছে
 * (InventoryOverviewCards-এ), অর্থে কাছাকাছি, আর ঝুঁকিহীন।
 */
import { ClipboardList, CircleCheck, Package, AlarmClock } from "lucide-react";
import KitchenTypeFilter from "@/components/admin/KitchenTypeFilter";
import type { KitchenTypeFilter as KitchenTypeFilterValue } from "@/lib/kitchen-status";

/**
 * src/components/admin/KitchenOverviewCards.tsx
 *
 * Figma Frame 2147236297 — Kitchen পাতার Overview: Total Orders ·
 * Ready to Serve · Preparing · Pending।
 *
 * খোলসটা Staff/Users/Suppliers/Inventory-র Overview-এর হুবহু নকল
 * (Frame 2147236275: column, padding 30, gap 24, radius 20, সাদা; ভেতরে
 * Card: column, padding 16, gap 20, radius 16, #F9F6F3)। নতুন করে
 * কিছু আঁকা হয়নি — একই জিনিস পাঁচ জায়গায় পাঁচরকম হলে সেটাই সবচেয়ে
 * চোখে লাগে।
 *
 * ── ছাঁকনিটা period নয়, অর্ডারের ধরন ────────────────────────────────
 *
 * Figma-তে শিরোনামের পাশে "Today ⌄" আঁকা, কিন্তু সেটা বসানো যায় না:
 * নিচের চারটের মধ্যে তিনটে (Ready to Serve · Preparing · Pending)
 * **এই মুহূর্তের অবস্থা**, আর তার কোনো "গত সপ্তাহ" রূপ হয় না।
 * বসালে তিনটে অনড় থেকে একটা বদলাত — ব্যবহারকারী ধরে নিতেন চারটেই
 * বদলেছে। পুরো যুক্তিটা `lib/kitchen-status.ts`-এ।
 *
 * ধরন দিয়ে ছাঁকলে চারটেই বদলায়, আর প্রশ্নটাও রান্নাঘরের নিজের:
 * "টেবিলের কটা ঝুলছে, ডেলিভারির কটা"।
 *
 * ⚠️ ছাঁকনিটা **নিচের বোর্ড ছোঁয় না**, শুধু এই চারটে সংখ্যার পরিধি
 * ঠিক করে — Users/Staff/Inventory-র Overview ছাঁকনিগুলোর মতোই।
 * বোর্ডের নিজের ছাঁকনি toolbar-এ ("All Statuses")।
 */
export default function KitchenOverviewCards({
  totalToday,
  readyToServe,
  preparing,
  pending,
  type,
}: {
  /** আজ তৈরি হওয়া অর্ডার — রান্নাঘরের দিনের কাজের মাপ। */
  totalToday: number;
  /** রান্না শেষ, এখনো তুলে নেওয়া হয়নি। */
  readyToServe: number;
  /** চুলায় আছে। */
  preparing: number;
  /** এখনো ধরাই হয়নি। */
  pending: number;
  /** URL-এর `type` param — চারটে সংখ্যারই পরিধি। */
  type: KitchenTypeFilterValue;
}) {
  const CARDS = [
    {
      label: "Total Orders",
      value: totalToday,
      hint: "Kitchen Orders",
      icon: ClipboardList,
    },
    {
      label: "Ready to Serve",
      value: readyToServe,
      hint: "Awaiting Pickup",
      icon: CircleCheck,
    },
    {
      label: "Preparing",
      value: preparing,
      hint: "Currently Cooking",
      icon: Package,
    },
    {
      label: "Pending",
      value: pending,
      hint: "Kitchen Tasks Remaining",
      icon: AlarmClock,
    },
  ];

  return (
    <div className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
      {/* Figma: শিরোনাম বাঁয়ে, ছাঁকনির pill ডান কিনারায়। */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Overview
        </h2>

        <KitchenTypeFilter value={type} />
      </div>

      {/* Figma Frame 2147236226: row, gap 20, চারটে কার্ড সমান ভাগে। */}
      <div className="grid gap-5 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card) => (
          /* Card: column, padding 16, gap 20, radius 16, BG #F9F6F3। */
          <div key={card.label} className="flex flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="min-w-0 truncate font-frank-ruhl text-[20px] font-medium leading-none text-black">
                {card.label}
              </h3>
              {/* Frame 2147232069: 40×40, BG #FFFFFF, পুরো গোল,
                  icon 18×18 stroke 1.2। */}
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                <card.icon
                  className="h-[18px] w-[18px] text-black"
                  strokeWidth={1.2}
                  aria-hidden="true"
                />
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <p className="font-frank-ruhl text-[24px] font-semibold leading-none text-black">
                {card.value}
              </p>
              <p className="font-sora text-[12px] font-normal leading-none text-black/70">
                {card.hint}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
