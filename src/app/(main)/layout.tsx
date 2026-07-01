// src/app/(main)/layout.tsx  ← নতুন ফাইল বানান
import Navbar from "@/components/Navbar";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar />
      <div className="flex flex-1">
        <div className="sticky top-44 h-fit w-20 z-40">
          <Navbar />
        </div>
        <div className="flex-1 ml-20">{children}</div>
      </div>
      {/* Footer sits outside the ml-20 wrapper so its background is full-bleed */}
      <Footer />
    </div>
  );
}