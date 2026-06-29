import Banner from "@/components/Banner";
import Buffet from "@/components/Buffet";
import Services from "@/components/Services";
import Signature from "@/components/Signature";

export default function Home() {
  return (
    <div>
      <Banner />
      <Services />
      <Buffet />
      <Signature />
    </div>
  );
}
