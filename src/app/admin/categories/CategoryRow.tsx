"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "react-toastify";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

export type CategoryRowItem = {
  id: string;
  title: string;
  isAvailable: boolean;
};

/**
 * src/app/admin/categories/CategoryRow.tsx
 *
 * Figma Frame 2147236345 — একটা শ্রেণির সারি: column, padding 16,
 * gap 20, radius 20, BG #F9F6F3; ভেতরে row — নাম (Frank Ruhl 500 20px)
 * বাঁয়ে, gradient pill (100×40, padding 12, radius 100, লেখা Sora 400
 * 14px) ডানে।
 *
 * ── Edit/Delete কোথায় গেল ───────────────────────────────────────────
 *
 * ⚠️ Figma-র সারিতে শুধু নাম আর pill — Edit/Delete নেই। কিন্তু ওদুটো
 * ফেলে দেওয়া যায় না, নাহলে শ্রেণির নাম বদলানো বা মোছার আর কোনো
 * পথই থাকে না (এখন ওটাই এই পাতার একমাত্র কাজ)।
 *
 * তাই ওগুলো pill চাপলে খোলা তাকটার ভেতরে। এতে Figma-র সারিটা
 * পরিষ্কার থাকে, আর কাজদুটোও হারায় না — বরং **মুছে ফেলার আগে**
 * ভেতরে কী কী পদ আছে সেটা চোখের সামনেই থাকে, যা একটা ধ্বংসাত্মক
 * কাজের আগে ভালো।
 */
export default function CategoryRow({
  id,
  name,
  items,
}: {
  id: string;
  name: string;
  items: CategoryRowItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to delete");
        }
        setConfirming(false);
        router.refresh();
        toast.success(`"${name}" deleted.`);
      } catch (error) {
        setConfirming(false);
        // ⚠️ API-র নিজের বার্তাটা দেখানো হয় — "শ্রেণিতে পদ আছে, তাই
        // মোছা যাবে না" জাতীয় কারণটা ওখান থেকেই আসে, আর সেটা
        // ব্যবহারকারীর জানা দরকার।
        toast.error(error instanceof Error ? error.message : "Couldn't delete the category.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5 rounded-[20px] bg-[#F9F6F3] p-4">
      {/* Frame 2147236338: row, gap 20, নাম বাঁয়ে, pill ডানে। */}
      <div className="flex items-center justify-between gap-5">
        <h3 className="min-w-0 truncate font-frank-ruhl text-[20px] font-medium leading-none text-black">
          {name}
        </h3>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className={`flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-3 font-sora text-[14px] font-normal leading-none text-white transition-opacity hover:opacity-90 ${FOCUS_RING}`}
        >
          {items.length} {items.length === 1 ? "Item" : "Items"}
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-4 border-t border-black/10 pt-4">
          {items.length === 0 ? (
            <p className="font-sora text-[12px] leading-none text-black/70">
              No menu items in this category yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 font-sora text-[12px] leading-none text-black"
                >
                  <span className="min-w-0 truncate">{item.title}</span>
                  {/* ⚠️ যে পদগুলো এখন পাওয়া যাচ্ছে না সেগুলো আলাদা করে
                      দেখানো — Overview-র "Active" গণনাটা ঠিক এই
                      হিসাবেই হয়, তাই সংখ্যাটা কোথা থেকে এল সেটা
                      এখানেই মিলিয়ে নেওয়া যায়। */}
                  {!item.isAvailable && (
                    <span className="shrink-0 rounded-full bg-[#FAE7EC] px-2 py-1 font-sora text-[11px] leading-none text-[#D72A37]">
                      Unavailable
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/categories/${id}/edit`}
              className={`flex h-10 shrink-0 items-center justify-center rounded-full border border-black px-3 font-sora text-[14px] font-normal leading-none text-black transition-colors hover:bg-black hover:text-white ${FOCUS_RING}`}
            >
              Edit
            </Link>

            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={`flex h-10 shrink-0 items-center justify-center rounded-full border border-[#D72A37] px-3 font-sora text-[14px] font-normal leading-none text-[#D72A37] transition-colors hover:bg-[#D72A37] hover:text-white ${FOCUS_RING}`}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/**
       * ⚠️ `confirm()` নয়, প্রজেক্টের নিজের ConfirmDialog — আগের
       * DeleteCategoryButton-এ browser-এর `confirm()` ছিল, যেটা
       * নকশার বাইরে, style করা যায় না, আর মোবাইলে পাতার উপরে একটা
       * বেমানান সাদা বাক্স হয়ে বসে।
       */}
      <ConfirmDialog
        open={confirming}
        title={`Delete "${name}"?`}
        message={
          items.length > 0
            ? `This category has ${items.length} menu item${items.length === 1 ? "" : "s"}. You'll need to move or remove them first.`
            : "This cannot be undone."
        }
        confirmLabel="Delete"
        tone="danger"
        pending={isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
