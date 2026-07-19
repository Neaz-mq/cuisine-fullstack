import type { Metadata } from "next";
import Awards from "@/components/Awards";
import Famous from "@/components/Famous";
import Members from "@/components/Members";
import Support from "@/components/Support";

export const metadata: Metadata = {
  title: "Our Chefs",
  description: "Meet the award-winning chefs and team behind Cuisine.",
};

export default function ChefsPage() {
  return (
    <main>
      <Awards />
      <Famous />
      <Support />
      <Members />
    </main>
  );
}