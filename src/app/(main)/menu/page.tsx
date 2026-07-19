import type { Metadata } from "next";
import Delights from "@/components/Delights";
import Explore from "@/components/Explore";
import Items from "@/components/Items";
import Weekly from "@/components/Weekly";
import RecommendedForYou from "@/components/RecommendedForYou";

export const metadata: Metadata = {
  title: "Menu",
  description: "Browse our full menu and order online for delivery or dine-in.",
};

export default function MenuPage() {
  return (
    <main>
      <Explore />
      <RecommendedForYou />
       <Items />
       <Weekly />
       <Delights />
    </main>
  );
}