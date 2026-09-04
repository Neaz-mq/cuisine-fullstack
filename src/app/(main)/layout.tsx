import SiteTopBar from "@/components/SiteTopBar";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";

/**
 * src/app/(main)/layout.tsx
 *
 * ⚠️ খাড়া rail-টা চলে গেছে। আগে এখানে ছিল:
 *
 *     <div className="sticky top-44 h-fit w-20 z-40"><Navbar /></div>
 *     <div className="flex-1 ml-20">{children}</div>
 *
 * অর্থাৎ বাঁয়ে ২০ ইউনিটের একটা স্থির পটি, আর সব পাতা `ml-20` দিয়ে
 * সরানো। Figma-তে rail নেই — navbar আড়াআড়ি, পাতা পুরো প্রস্থ পায়।
 *
 * ⚠️ এই বদলটা **`(main)`-এর সব পাতায়** লাগে, শুধু হোমে নয় — menu,
 * chefs, carts, order, dine-in, account, track। ওদের ভেতরে যদি
 * কোথাও ওই ২০ ইউনিটের ক্ষতিপূরণ ধরে নিয়ে মাপ বসানো থাকে (যেমন
 * ঋণাত্মক margin, বা `calc(100vw - 5rem)`), সেটা এখন আলগা হয়ে
 * যাবে। একটা করে খুলে দেখে নেবেন — বিশেষত `/menu` আর `/carts`,
 * ওদুটোই সবচেয়ে চওড়া।
 *
 * ⚠️ পুরনো `TopBar.tsx` আর `Navbar.tsx` **মুছিনি**। এখন ওদের কেউ
 * ব্যবহার করে না, কিন্তু নতুন দুটো চোখে দেখে পছন্দ হওয়ার আগে
 * মুছে ফেলা মানে ফেরার পথ বন্ধ করা। যাচাই করে তারপর:
 *
 *     grep -rn "components/TopBar\\|components/Navbar" src/
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteTopBar />
      <SiteNavbar />
      {/* Footer-টা এই মোড়কের বাইরে নয় — এখন আর `ml-20` নেই, তাই
          full-bleed পটভূমির জন্য আলাদা করে রাখার দরকারও নেই। */}
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
