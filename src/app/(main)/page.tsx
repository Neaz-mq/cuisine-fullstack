import Hero from "@/components/landing/Hero";
import BrandStrip from "@/components/landing/BrandStrip";
import AboutUs from "@/components/landing/AboutUs";
import ServicesSection from "@/components/landing/ServicesSection";
import SignatureSection from "@/components/landing/SignatureSection";
import ComboSection from "@/components/landing/ComboSection";
import GuestsSection from "@/components/landing/GuestsSection";
import FaqSection from "@/components/landing/FaqSection";
import OneAppSection from "@/components/landing/OneAppSection";


/**
 * src/app/(main)/page.tsx
 *
 * ⚠️ পুরনো `<Buffet />` আর `<Signature />` সরিয়ে
 * `<SignatureSection />` — Figma-তে ওই দুটোর জায়গায় একটাই section
 * ("Our Signature", gradient পটভূমি)।
 *
 * পুরনো ফাইলগুলো **মুছিনি**। এখন অব্যবহৃত: `Banner.tsx`, `TopBar.tsx`,
 * `Navbar.tsx`, `Services.tsx`, `Buffet.tsx`, `Signature.tsx`। নতুন
 * নকশা চোখে দেখে পছন্দ হলে যাচাই করে মুছবেন:
 *
 *     grep -rn "components/Buffet\|components/Signature" src/
 *
 * ⚠️ বাকি ধাপ: One App · Footer।
 * নিচের `<Deliver />` এখনো পুরনো নকশার।
 */
export default function Home() {
  return (
    <div>
      <Hero />
      <BrandStrip />
      <AboutUs />
      <ServicesSection />
      <SignatureSection />
      <ComboSection />
      <GuestsSection />
      <FaqSection />
      <OneAppSection />
    </div>
  );
}
