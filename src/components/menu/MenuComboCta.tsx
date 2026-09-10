import Link from "next/link";
import { ArrowRight } from "lucide-react";

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

/**
 * src/components/menu/MenuComboCta.tsx
 *
 * Figma Frame 2147236006 — menu পাতার শেষ ব্লক: column, padding
 * 100px 80px, gap 60, পটভূমি **সাদা**।
 *
 *   Frame 2147236065  column, align center, gap 20
 *     h2              Frank Ruhl 600 64px/114%, center, −0.01em,
 *                     #141921, চওড়া 1008
 *     p               Sora 400 16px/160%, center, Black/70, চওড়া 636
 *   Frame 2147236401  row, gap 12
 *     outline         182×56, border 1px কালো, radius 90
 *     gradient        190×56, radius 100, ডানে 44×44 সাদা গোল + তীর
 *
 * ⚠️ হোমপেজের `components/landing/ComboSection.tsx`-এর সাথে গুলিয়ে
 * ফেলার নয়। Figma-তে frame-এর নামও এক (2147236006) আর শিরোনামও প্রায়
 * এক, কিন্তু ওটা তিনটে combo **কার্ড** সহ একটা পুরো section (পটভূমি
 * #F9F6F3), আর এটা কেবল একটা শিরোনাম + দুটো বোতাম (পটভূমি সাদা)।
 * designer একই শিরোনাম দুই জায়গায় ব্যবহার করেছেন, তাই দেখে ভুল হওয়া
 * সহজ — কিন্তু একটা দিয়ে অন্যটা চালানো যায় না।
 *
 * ⚠️ "Download Menu" আসলে কিছু download করে না — কোনো PDF তৈরির
 * ব্যবস্থা এই অ্যাপে নেই, আর মেনু তো এই পাতাতেই। ওটা `/order`-এ
 * পাঠায়, যেখানে পুরো তালিকা এক জায়গায়। সত্যিকারের PDF চাইলে আলাদা
 * একটা route লাগবে, সেটা এই নকশার বাইরে।
 *
 * ⚠️ "Book a Table" যায় `/reservation`-এ — `SiteNavbar`-এর
 * "Reservation" লিঙ্কটা যেখানে যায়, ঠিক সেখানেই। কিন্তু **ওই পাতাটা
 * এখনো বানানো হয়নি** (`app/(main)/`-এ `reservation` নেই), অর্থাৎ
 * দুটোই আপাতত 404। navbar-এর সাথে মিলিয়ে রাখা হলো যাতে পাতাটা
 * বানানোর দিন দুটোই একসাথে কাজ শুরু করে; ততদিন অন্য কোথাও পাঠাতে
 * চাইলে এখানকার `href`-টাই বদলাতে হবে।
 */
const DEFAULT_DESCRIPTION =
  "Save More with Our Curated Combo Meals — Enjoy More Flavor, More Variety, and More Value, All Packed into One Delicious Order.";

/**
 * ⚠️ দুটো ঐচ্ছিক prop, কারণ এই ব্লকটা দুই জায়গায় বসে আর Figma-তে
 * সামান্য আলাদা: `/menu`-এ দুটো বোতাম, আর ছাড়ের পাতায় (`/offers/…`)
 * কেবল "Book a Table", সাথে একটু ভিন্ন বর্ণনা।
 *
 * ডিফল্ট মানদুটো `/menu`-এর, তাই ওখানে কল করার ধরনটা বদলাতে হয়নি।
 */
export default function MenuComboCta({
  description = DEFAULT_DESCRIPTION,
  showMenuLink = true,
}: {
  description?: string;
  showMenuLink?: boolean;
} = {}) {
  return (
    <section className="bg-white px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-8 xl:gap-9">
        <div className="flex max-w-[1008px] flex-col items-center gap-4 xl:gap-5">
          <h2 className="text-center font-frank-ruhl text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#141921] md:text-[40px] lg:text-[52px] xl:text-[64px]">
            Can&apos;t Decide? Try Our Chef&apos;s Combo Deals
          </h2>

          <p className="max-w-[636px] text-center font-sora text-[14px] font-normal leading-[1.6] text-black/70 md:text-[16px]">
            {description}
          </p>
        </div>

        {/* Frame 2147236401: row, gap 12। */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {showMenuLink && (
            <Link
              href="/order"
              className={`flex h-[52px] items-center justify-center rounded-[90px] border border-black px-6 font-sora text-[15px] font-semibold leading-[1.6] text-black transition-colors hover:bg-black hover:text-white xl:h-14 ${FOCUS_RING}`}
            >
              Download Menu
            </Link>
          )}

          {/**
           * Figma: padding 14px 6px 14px 24px — ডান দিকটা কম, কারণ
           * ওখানে ৪৪px সাদা গোলটা বসে, আর সেটার নিজের ঘেরই ফাঁক তৈরি
           * করে। সমান padding দিলে বোতামটা ডান দিকে অকারণ চওড়া লাগত।
           */}
          {/**
            * ⚠️ আগে এখানে `/reservations` লেখা ছিল, আর সেটা ভুল —
            * বোতামের লেখা "Book a Table", অর্থাৎ গন্তব্য বুক করার
            * **ফর্ম**, তালিকা নয়। ওই route-টা তখন ছিলই না, তাই
            * ক্লিক করলে ৪০৪ আসত।
            *
            * এখন `/my-reservations` নামে একটা তালিকা-পাতা আছে, তাই
            * পুরোনো নামটা রেখে দিলে ভুলটা ৪০৪ থেকে বদলে **নীরব** হয়ে
            * যেত — গ্রাহক "Book a Table" চেপে নিজের পুরোনো booking-এর
            * তালিকায় গিয়ে পড়তেন।
            */}
          <Link
            href="/reservation"
            className={`flex h-[52px] items-center justify-center gap-3 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] py-[14px] pl-6 pr-1.5 font-sora text-[15px] font-semibold leading-[1.6] text-white transition-opacity hover:opacity-90 xl:h-14 ${FOCUS_RING}`}
          >
            Book a Table
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white xl:h-11 xl:w-11">
              <ArrowRight
                className="h-[18px] w-[18px] text-black"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
