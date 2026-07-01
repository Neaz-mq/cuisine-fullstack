import Brew from "@/components/Brew";
import Category from "@/components/Category";
import Popular from "@/components/Popular";

export default function OrderPage() {
  return (
    <main>
      <Category />
      <Popular />
      <Brew />
    </main>
  );
}