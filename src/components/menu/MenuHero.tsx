import { UtensilsCrossed } from "lucide-react";

/**
 * src/components/menu/MenuHero.tsx
 *
 * Figma "Web/Menu"-এর প্রথম অংশ — Frame 2147235230: column, align
 * center, gap 16, চওড়া 1280।
 *
 *   Level Button   139×38, সাদা, radius 100, padding 10, gap 6,
 *                  আইকন 16px, লেখা Sora 400 14px/130% কালো
 *   Frame …229     column, align center, gap 24, চওড়া 1108
 *     h1           Frank Ruhl 500 72px/100%, center, −0.01em
 *     p            Sora 400 18px/160%, center, Black/70, চওড়া 654
 *
 * ⚠️ Figma-র section-টায় (`padding: 0px 80px 60px`) উপরের কালো পটি আর
 * navbar-ও ধরা আছে, কিন্তু এই অ্যাপে ওদুটো `(main)/layout.tsx`-এ —
 * সব পাতায় এক। তাই এখানে কেবল নিচের অংশটা, আর উপরের padding শূন্য
 * নয় বরং navbar-এর সাথে ফাঁক রাখার মতো।
 *
 * পটভূমি #F9F6F3 — `SiteNavbar`-এর হুবহু একই রঙ, তাই দুটোর মাঝে কোনো
 * সীমারেখা চোখে পড়ে না, ঠিক যেমন Figma-তে।
 *
 * ⚠️ পুরনো `Explore.tsx` এই কাজটাই করত ("Explore Our Full Menu of
 * Signature Dishes" + splash ছবি) — সেটা আর ব্যবহার হয় না, কিন্তু
 * মুছিনি। যাচাই করে মুছবেন:
 *
 *     grep -rn "components/Explore" src/
 */
export default function MenuHero() {
  return (
    <section className="bg-[#F9F6F3] px-4 pb-12 pt-8 md:px-10 md:pb-14 xl:px-20 xl:pb-[60px] xl:pt-[60px]">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-4">
        {/* Level Button — সাদা pill, ভেতরে আইকন আর লেখা। */}
        <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-2.5 font-sora text-[12px] font-normal leading-[1.3] text-black md:text-[14px]">
          <UtensilsCrossed className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          Our Full Menu
        </span>

        <div className="flex max-w-[1108px] flex-col items-center gap-4 xl:gap-6">
          {/**
           * ⚠️ ৭২px কেবল xl-এ। ছোট পর্দায় ওই মাপে একটা শব্দও এক লাইনে
           * ধরত না — "Ingredients" একাই ~৩৮০px। তাই ২৮ → ৪০ → ৫২ → ৭২,
           * Hero.tsx আর SignatureSection-এর হুবহু একই ধাপে।
           */}
          <h1 className="text-center font-frank-ruhl text-[28px] font-medium leading-[1.05] tracking-[-0.01em] text-black md:text-[44px] lg:text-[56px] xl:text-[72px] xl:leading-none">
            Every Dish, Crafted with Fresh Ingredients and Bold Flavor
          </h1>

          <p className="max-w-[654px] text-center font-sora text-[14px] font-normal leading-[1.6] text-black/70 md:text-[16px] xl:text-[18px]">
            From sizzling burgers to slow-simmered biryani, browse everything we make
            fresh, daily, just for you.
          </p>
        </div>
      </div>
    </section>
  );
}
