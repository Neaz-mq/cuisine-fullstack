import type { Metadata } from "next";
import ChefsHero from "@/components/chefs/ChefsHero";
import OurJourney from "@/components/chefs/OurJourney";
import MeetTheExperts from "@/components/chefs/MeetTheExperts";
import WhyGuestsChooseUs from "@/components/chefs/WhyGuestsChooseUs";
import MenuCTA from "@/components/chefs/MenuCTA";

export const metadata: Metadata = {
  title: "Our Chefs",
  description: "Meet the award-winning chefs and team behind Cuisine.",
};

/**
 * src/app/(main)/chefs/page.tsx
 *
 * Figma "Web/About Us" — পাঁচটা অংশ, উপর থেকে নিচে।
 *
 * ⚠️ পুরোনো চারটে component — Awards, Famous, Support, Members — এখান
 * থেকে সরানো হয়েছে। ওগুলো একটা সম্পূর্ণ আলাদা নকশার, আর প্রতিটাতেই
 * `sm:-ml-[10.5rem]` জাতীয় হাতে-মাপা ঋণাত্মক margin ছিল, যা নির্দিষ্ট
 * কিছু পর্দার প্রস্থে ছাড়া ভেঙে পড়ত — পাতাটা যে এলোমেলো দেখাচ্ছিল,
 * কারণ ঠিক সেটাই।
 *
 * ⚠️ ফাইলগুলো **মুছিনি**। Awards/Famous/Support/Members এখনো
 * `src/components/`-এ আছে, আর অন্য কোথাও import হয় কিনা তা এই বদলের
 * অংশ নয়। নিশ্চিত হয়ে নিয়ে পরে আলাদা commit-এ সরানোই নিরাপদ।
 *
 * ⚠️ Topbar আর navbar এখানে নেই — `app/(main)/layout.tsx`-এ, সব
 * পাতায় ভাগ করা।
 */
export default function ChefsPage() {
  return (
    <main>
      <ChefsHero />
      <OurJourney />
      <MeetTheExperts />
      <WhyGuestsChooseUs />
      <MenuCTA />
    </main>
  );
}
