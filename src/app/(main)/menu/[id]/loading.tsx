/**
 * src/app/(main)/menu/[id]/loading.tsx
 *
 * পদের নিজের পাতার কঙ্কাল।
 *
 * ⚠️ আলাদা ফাইল কেন: `menu/loading.tsx` তার নিচের সব পাতাকেও ঢাকে, তাই এটা না
 * থাকলে একটা পদে ক্লিক করলে মেনু-*তালিকার* কঙ্কাল দেখাত — ভুল আকার, আর
 * আসল পাতা আসার সময় লেআউট ঝাঁকুনি দিত। কাছের (nested) `loading.tsx`
 * বাইরেরটাকে বদলে দেয়।
 */
function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-black/[0.07] ${className}`} />;
}

export default function MenuItemLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the dish…</span>

      <section className="bg-[#F9F6F3] px-4 py-10 md:px-10 xl:px-20 xl:py-[80px]">
        <div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-2 lg:gap-12">
          <Bone className="aspect-[4/3] w-full rounded-[30px] bg-white" />

          <div className="flex flex-col gap-5">
            <Bone className="h-5 w-24 rounded-full" />
            <Bone className="h-12 w-4/5" />
            <div className="flex gap-2">
              <Bone className="h-7 w-20 rounded-full" />
              <Bone className="h-7 w-20 rounded-full" />
              <Bone className="h-7 w-20 rounded-full" />
            </div>
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-2/3" />
            <Bone className="mt-3 h-10 w-32" />
            <Bone className="h-14 w-full max-w-[320px] rounded-full" />
          </div>
        </div>
      </section>
    </div>
  );
}