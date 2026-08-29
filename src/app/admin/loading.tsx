/**
 * src/app/admin/loading.tsx
 *
 * ⚠️ এই ফাইলটা না থাকাটাই "Dashboard-এ click করলে পাতা refresh হয়"
 * অনুভূতির আসল কারণ ছিল।
 *
 * Sidebar-এর link একটা সাধারণ next/link — browser সত্যিই কিছু reload
 * করে না। কিন্তু /admin একটা dynamic server component, আর সেটা প্রায়
 * সতেরোটা Prisma query চালায় (Promise.all-এর পনেরোটা, তারপর settings,
 * menuItem আর menuItemIngredient আলাদা করে)। Next-এর কাছে দেখানোর মতো
 * কিছু না থাকায় এতক্ষণ পুরনো পাতাটাই জমে থাকত, তারপর হঠাৎ নতুনটা বসে
 * যেত আর scroll উপরে চলে যেত — দেখতে হুবহু refresh-এর মতো।
 *
 * loading.tsx থাকলে Next তখনই এটা দেখায়, আর — এটাই বড় লাভ — hover
 * করার সময়েই এটা prefetch করে রাখে। ফলে click-এর সাড়া তাৎক্ষণিক।
 *
 * ⚠️ আকারগুলো page.tsx-এর সাথে মিলিয়ে রাখা: একই radius, একই gap,
 * একই উচ্চতা। নাহলে আসল বিষয়বস্তু এলে সব কিছু লাফ দিয়ে সরত, আর
 * skeleton-এর উদ্দেশ্যটাই ব্যর্থ হতো।
 */
export default function AdminDashboardLoading() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <span className="sr-only">Loading dashboard…</span>

      <div className="animate-pulse space-y-4" aria-hidden="true">
        {/* --- Welcome header --- */}
        <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
          <div className="h-[30px] w-full max-w-[420px] rounded-full bg-black/[0.06]" />
          <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:w-auto">
            <div className="h-11 w-[130px] rounded-full bg-white" />
            <div className="h-11 w-[160px] rounded-full bg-black/[0.08]" />
          </div>
        </div>

        {/**
         * Hero card-টা ধূসর নয়, আসল gradient-টাই।
         *
         * একটা ধূসর বাক্স বসালে পাতাটা কমলা → ধূসর → কমলা করে ঝিলিক
         * দিত, যেটা অপেক্ষার চেয়েও বেশি চোখে লাগে। রঙটা যেহেতু
         * তথ্যের উপর নির্ভর করে না, ওটা প্রথম থেকেই সত্যি হয়ে থাকতে
         * পারে — কেবল ভেতরের সংখ্যাগুলোই অপেক্ষা করে।
         */}
        <div className="flex flex-col gap-8 rounded-[20px] bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] p-5 md:gap-[50px] md:p-[30px]">
          <div className="h-8 w-[190px] rounded-full bg-white/30" />
          <div className="space-y-4">
            <div className="h-12 w-[240px] rounded-full bg-white/30" />
            <div className="h-8 w-[220px] rounded-full bg-white/25" />
          </div>
        </div>

        {/* --- তিনটে stat card — Figma: gap 20, radius 16, উচ্চতা 142 --- */}
        <div className="grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex h-[142px] flex-col gap-5 rounded-[16px] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="h-5 w-[140px] rounded-full bg-black/[0.06]" />
                <div className="h-[34px] w-[34px] shrink-0 rounded-full bg-[#F9F6F3]" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-6 w-[56px] rounded-full bg-black/[0.08]" />
                <div className="h-7 w-[92px] rounded-full bg-black/[0.05]" />
              </div>
              <div className="h-3 w-[86px] rounded-full bg-black/[0.05]" />
            </div>
          ))}
        </div>

        {/* --- AI Business Summary --- */}
        <div className="flex items-center justify-between gap-4 rounded-[20px] bg-white p-5 md:p-6">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-3 w-[170px] rounded-full bg-black/[0.06]" />
            <div className="h-4 w-full max-w-[340px] rounded-full bg-black/[0.05]" />
          </div>
          <div className="h-11 w-[120px] shrink-0 rounded-full bg-black/[0.06]" />
        </div>

        {/* --- Recent Orders --- */}
        <div className="flex flex-col gap-5 rounded-[20px] bg-white p-5 md:p-[30px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="h-[30px] w-[200px] rounded-full bg-black/[0.06]" />
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-[122px] rounded-full bg-[#F9F6F3]" />
              <div className="h-10 w-[110px] rounded-full bg-[#F9F6F3]" />
            </div>
          </div>

          {/* Figma-র cream বাক্স — radius 12, padding 16। */}
          <div className="rounded-[12px] bg-[#F9F6F3] p-4">
            <div className="mb-5 h-5 w-full rounded-full bg-black/[0.07]" />
            {/* দশটা সারি — ORDERS_PER_PAGE-এর সমান, যাতে বাক্সের উচ্চতা
                আসল তালিকার কাছাকাছি থাকে আর নিচের কার্ডগুলো না লাফায়। */}
            <div className="space-y-[18px]">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-4 w-full rounded-full bg-black/[0.04]" />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="h-4 w-[220px] rounded-full bg-black/[0.05]" />
            <div className="flex items-center gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[34px] w-[34px] rounded-lg bg-[#F9F6F3]" />
              ))}
            </div>
          </div>
        </div>

        {/* --- Kitchen Inventory --- */}
        <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="h-[30px] w-[230px] rounded-full bg-black/[0.06]" />
            <div className="h-10 w-[140px] rounded-full bg-[#F9F6F3]" />
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex h-[142px] flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="h-5 w-[110px] rounded-full bg-black/[0.06]" />
                  <div className="h-10 w-10 shrink-0 rounded-full bg-white" />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="h-6 w-[48px] rounded-full bg-black/[0.07]" />
                  <div className="h-3 w-[130px] rounded-full bg-black/[0.05]" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- নিচের দুই কার্ড --- */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[20px] bg-white p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-[9.58px]">
                <div className="h-4 w-[110px] rounded-full bg-black/[0.05]" />
                <div className="h-7 w-[150px] rounded-full bg-black/[0.07]" />
              </div>
              <div className="h-10 w-[120px] shrink-0 rounded-full bg-[#F9F6F3]" />
            </div>
            {/* Butterfly chart-এর জায়গা — কেন্দ্ররেখার দু'পাশে দুই সারি। */}
            <div className="mt-7 space-y-2">
              <div className="h-[120px] rounded-2xl bg-black/[0.03]" />
              <div className="h-[120px] rounded-2xl bg-black/[0.03]" />
            </div>
          </div>

          <div className="flex flex-col gap-5 rounded-[20px] bg-white p-5 md:p-[30px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="h-[30px] w-[210px] rounded-full bg-black/[0.06]" />
              <div className="h-10 w-[120px] rounded-full bg-[#F9F6F3]" />
            </div>
            <div className="flex flex-col gap-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 md:gap-5">
                  <div className="h-4 w-[104px] shrink-0 rounded-full bg-black/[0.05]" />
                  <div className="h-8 min-w-0 flex-1 rounded-full bg-[#F9F6F3]" />
                  <div className="h-8 w-[83px] shrink-0 rounded-full bg-[#F9F6F3]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}