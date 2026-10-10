/**
 * src/app/(main)/menu/loading.tsx
 *
 * /menu-তে ক্লিক করার **সাথে সাথে** এটা দেখায়, সার্ভারের রেসপন্সের অপেক্ষায়
 * না থেকে।
 *
 * ── কেন এটা সবচেয়ে বড় পার্থক্য ─────────────────────────────────────
 * /menu `force-dynamic` — প্রতিটা ভিজিটে database ছুঁয়ে render হয়। এমন
 * পাতায় `loading.tsx` না থাকলে:
 *   • Next.js লিঙ্কটা আগে থেকে (prefetch) আনে না, কারণ আনার মতো স্থির
 *     কিছুই নেই;
 *   • ক্লিকের পর পুরো সার্ভার-রেসপন্স আসা পর্যন্ত পুরনো পাতাটাই আটকে থাকে
 *     — কোনো সাড়া নেই, যেন ক্লিকই হয়নি।
 * `loading.tsx` থাকলে লিঙ্কটা prefetch হয় এই কঙ্কালসহ, তাই ক্লিকে পাতা
 * তখনই বদলে যায়; আসল মেনু আসার সাথে সাথে চুপচাপ জায়গা নেয়।
 *
 * Server component, কোনো JS নেই — `animate-pulse` শুধু CSS। মাপগুলো আসল
 * পাতার কাছাকাছি (hero → offers → categories), যাতে আসল মেনু এলে লেআউট
 * লাফ না দেয়।
 */
function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-black/[0.07] ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-[30px] bg-white p-3 pb-5">
      <Bone className="h-[203px] w-full rounded-[24px]" />
      <div className="flex flex-col gap-3 px-3">
        <Bone className="h-6 w-2/3" />
        <div className="flex gap-1.5">
          <Bone className="h-6 w-16 rounded-full" />
          <Bone className="h-6 w-16 rounded-full" />
          <Bone className="h-6 w-16 rounded-full" />
        </div>
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-4/5" />
        <div className="mt-2 flex items-center justify-between">
          <Bone className="h-7 w-20" />
          <Bone className="h-11 w-32 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function MenuLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the menu…</span>

      {/* Hero */}
      <section className="bg-[#F9F6F3] px-4 py-14 md:px-10 xl:px-20 xl:py-[100px]">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-5">
          <Bone className="h-[38px] w-[150px] rounded-full bg-white" />
          <Bone className="h-12 w-full max-w-[640px] md:h-16" />
          <Bone className="h-4 w-full max-w-[420px] rounded-full" />
        </div>
      </section>

      {/* Today's Offers */}
      <section className="bg-white px-4 py-12 md:px-10 xl:px-20 xl:py-[80px]">
        <div className="mx-auto grid max-w-[1280px] gap-4 md:grid-cols-3">
          <Bone className="h-[170px] rounded-[30px]" />
          <Bone className="hidden h-[170px] rounded-[30px] md:block" />
          <Bone className="hidden h-[170px] rounded-[30px] md:block" />
        </div>
      </section>

      {/* Categories */}
      <section className="bg-[#F9F6F3] px-4 py-12 md:px-10 xl:px-20 xl:py-[100px]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8">
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <Bone key={i} className="h-11 w-28 shrink-0 rounded-full bg-white" />
            ))}
          </div>
          <Bone className="h-9 w-48" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CardSkeleton />
            <div className="hidden md:block">
              <CardSkeleton />
            </div>
            <div className="hidden xl:block">
              <CardSkeleton />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}