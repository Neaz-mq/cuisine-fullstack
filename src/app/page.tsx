import Banner from "@/components/Banner";
import Buffet from "@/components/Buffet";
import Services from "@/components/Services";
import Signature from "@/components/Signature";
import Testimonials from "@/components/Testimonials";

export default function Home() {
  return (
    <div>
      <Banner />
      <Services />
      <Buffet />
      <Signature />
      <Testimonials />  
    </div>
  );
}
