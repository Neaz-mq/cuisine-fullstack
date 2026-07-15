import Delights from "@/components/Delights";
import Explore from "@/components/Explore";
import Items from "@/components/Items";
import Weekly from "@/components/Weekly";
import RecommendedForYou from "@/components/RecommendedForYou";

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