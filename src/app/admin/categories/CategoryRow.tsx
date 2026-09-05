"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, UtensilsCrossed } from "lucide-react";
import { toast } from "react-toastify";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import CategoryFormModal from "./CategoryFormModal";
import MenuItemFormModal from "@/app/admin/menu/MenuItemFormModal";

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

export type CategoryRowItem = {
  id: string;
  title: string;
  description: string;
  /**
   * ⚠️ `number`, Prisma-র `Decimal` নয়। `MenuItem.price` DB-তে
   * numeric(12,3), আর Prisma সেটা একটা Decimal **object** হিসেবে ফেরায় —
   * ওটা সরল object নয় বলে server component থেকে client-এ পাঠানোই যায় না
   * ("Only plain objects can be passed to Client Components")। তাই
   * page.tsx-এ `Number()` দিয়ে রূপান্তর করে পাঠানো হয়।
   */
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
};

/**
 * src/app/admin/categories/CategoryRow.tsx
 *
 * Figma Frame 2147236340 — একটা শ্রেণির সারি: column, padding 16,
 * gap 20, radius 20, BG #F9F6F3; ভেতরে row — নাম (Frank Ruhl 500 20px)
 * বাঁয়ে, gradient pill (h 40, padding 12, radius 100, লেখা Sora 400
 * 14px) ডানে।
 *
 * ── খোলা তাকটা (Frame 2147236295) ───────────────────────────────────
 *
 * ⚠️ আগে এখানে শুধু পদগুলোর নাম একটার নিচে একটা লেখা হত, আর নিচে
 * শ্রেণির Edit/Delete — কারণ তখন খোলা অবস্থার কোনো নকশা হাতে ছিল না।
 * এখন আছে, আর সেটা অন্য জিনিস: প্রতিটা পদ **নিজের একটা সাদা কার্ড**।
 *
 *   Frame 2147236295  column, gap 16
 *   └ কার্ড           row, space-between, padding 16, gap 27,
 *                     h 110, BG #FFFFFF, radius 16
 *     ├ Frame 2147236287  row, gap 16
 *     │ ├ ছবি            78×78, BG #F8F8F8, radius 12
 *     │ └ Frame 2147236286  column, gap 8, w 204
 *     │   ├ নাম          Frank Ruhl 500 20px/120% #141921
 *     │   └ বিবরণ        Sora 400 12px/170% rgba(0,0,0,.7), ২ লাইন
 *     └ Frame 2147236283  row, gap 12
 *       ├ Edit           86×50, border 1px #000, radius 100, Sora 16
 *       └ Delete         86×50, BG #D72A37, radius 100, সাদা লেখা
 *
 * উচ্চতা মিলিয়ে দেখা: 16 + 40 + 20 + (3×110 + 2×16) + 16 = 454 —
 * Figma-র frame-এর মাপ ঠিক এটাই, অর্থাৎ ছবির ভেতরের কার্ডগুলোই
 * তালিকা, আলাদা কোনো separator বা header ওখানে নেই।
 *
 * ⚠️ css-এ একটা `Frame 2147235205` ("Food Available", সাদা pill,
 * position: absolute, left 264 top 16) আছে যেটা render-এ দেখা যায় না
 * — 264px ছবির (78px) অনেক বাইরে, বিবরণের উপরে গিয়ে পড়ত। ওটা অন্য
 * কার্ড থেকে রয়ে যাওয়া layer, তাই বসানো হয়নি। তার বদলে যে পদ এখন
 * পাওয়া যাচ্ছে না সেটার নামের পাশে ছোট একটা "Unavailable" pill —
 * Overview-র "Active" গণনাটা ঠিক এই হিসাবেই হয়, তাই সংখ্যাটা কোথা
 * থেকে এল এখানেই মিলিয়ে নেওয়া যায়।
 *
 * ── Edit/Delete এখন কার? ────────────────────────────────────────────
 *
 * নকশার কার্ডে বোতাম দুটো **পদের**, শ্রেণির নয় — তাই Edit খোলে
 * `MenuItemFormModal` (পদটার নিজের form, এই পাতা ছেড়ে না গিয়ে) আর
 * Delete ডাকে DELETE /api/admin/menu-items/<id>।
 *
 * ⚠️ ঐ route-টা `menu` scope চায়, এই পাতা চায় `categories` — দুটো
 * আলাদা scope, কিন্তু matrix-এ (lib/permissions.ts) দুটোই কেবল
 * OWNER/MANAGER-এর কাছে ALL_SCOPES হয়ে আসে, তাই যে এই পাতা খুলতে
 * পারে সে ঐ route-ও ডাকতে পারে। কোনোদিন কোনো role-কে শুধু
 * `categories` দেওয়া হলে এই বোতামটা 403 পাবে — তখন হয় scope-টা
 * সঙ্গে দিতে হবে, নয় বোতামটা লুকাতে হবে।
 *
 * শ্রেণির নিজের Edit/Delete তাই তাকটার একদম নিচে সরানো হলো, ইচ্ছে করেই
 * ছোট করে (h 40, outline) — নকশায় ওগুলো নেই, কিন্তু ফেলে দিলে শ্রেণির
 * নাম বদলানো বা মোছার আর কোনো পথই থাকে না।
 */
export default function CategoryRow({
  id,
  name,
  items,
  categories,
  currency,
}: {
  id: string;
  name: string;
  items: CategoryRowItem[];
  /** সব শ্রেণি — পদ সম্পাদনার modal-এর Category dropdown-এর জন্য। */
  categories: readonly { value: string; label: string }[];
  /** দামের ঘরের গায়ে দেখানোর জন্য, যেমন "USD"। */
  currency?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  /**
   * কোন পদটা সম্পাদনা হচ্ছে — boolean নয়, পুরো পদটাই। modal-টার
   * প্রাথমিক মান ওখান থেকেই আসে, আর তালিকায় ইতিমধ্যে সব কটা মাঠ
   * থাকায় prefill-এর জন্য বাড়তি কোনো fetch লাগে না।
   */
  const [editingItem, setEditingItem] = useState<CategoryRowItem | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * একটাই ConfirmDialog, দুটো ভিন্ন কাজের জন্য — তাই null নয় এমন
   * অবস্থায় সে নিজেই বলে দেয় সে কোনটা: শ্রেণি না পদ। দুটো আলাদা
   * boolean রাখলে "দুটোই true" নামের একটা অসম্ভব অবস্থা টাইপেই
   * বৈধ থাকত।
   */
  const [confirming, setConfirming] = useState<
    { kind: "category" } | { kind: "item"; id: string; title: string } | null
  >(null);

  function handleDeleteCategory() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to delete");
        }
        setConfirming(null);
        router.refresh();
        toast.success(`"${name}" deleted.`);
      } catch (error) {
        setConfirming(null);
        // ⚠️ API-র নিজের বার্তাটা দেখানো হয় — "শ্রেণিতে পদ আছে, তাই
        // মোছা যাবে না" জাতীয় কারণটা ওখান থেকেই আসে, আর সেটা
        // ব্যবহারকারীর জানা দরকার।
        toast.error(error instanceof Error ? error.message : "Couldn't delete the category.");
      }
    });
  }

  function handleDeleteItem(itemId: string, itemTitle: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/menu-items/${itemId}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to delete");
        }
        setConfirming(null);
        router.refresh();
        toast.success(`"${itemTitle}" deleted.`);
      } catch (error) {
        setConfirming(null);
        // পদটার যদি আগের order থাকে, route-টা 409 দিয়ে বলে
        // "unavailable করে দিন" — সেই পরামর্শটাই এখানে দেখা দরকার।
        toast.error(error instanceof Error ? error.message : "Couldn't delete the item.");
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

      {/* Frame 2147236295: column, gap 16। */}
      {open && (
        <div className="flex flex-col gap-4">
          {items.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 font-sora text-[12px] leading-[1.7] text-black/70">
              No menu items in this category yet.
            </p>
          ) : (
            items.map((item) => (
              /**
               * ⚠️ md-এর নিচে কার্ডটা column — নকশার row-টা 967px
               * চওড়ায় আঁকা, ফোনে ছবি+লেখা+দুটো বোতাম এক সারিতে রাখলে
               * বিবরণটা কয়েক অক্ষরের একটা খাঁজে পরিণত হয়। ≥768px-এ
               * হুবহু Figma: space-between, gap 27, উচ্চতা 110
               * (padding 16 + ভেতরের 78)।
               */
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-2xl bg-white p-4 md:flex-row md:items-center md:justify-between md:gap-[27px]"
              >
                {/* Frame 2147236287: row, gap 16। */}
                <div className="flex min-w-0 items-center gap-3 md:gap-4">
                  {/**
                   * Frame 2147225236: 78×78, BG #F8F8F8, radius 12।
                   *
                   * ⚠️ ৭৬৮-এর নিচে ৫৬px, আর এটা প্রসাধন নয়। ৩২০px পর্দায়
                   * এই কার্ডের ভেতরে থাকে ~১৯২px; ৭৮ + gap ১৬ নিলে নামের
                   * জন্য বাকি থাকে ~৯৮px — "Crispy French Fries" ওখানে
                   * "Crispy F…" হয়ে যেত। ৫৬ + gap ১২-তে ~১২৪px, দুই
                   * লাইনে পুরো নামটা ধরে।
                   */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#F8F8F8] md:h-[78px] md:w-[78px]">
                    {item.imageUrl ? (
                      /**
                       * ⚠️ `unoptimized` — reviews পাতার মতোই। পদের ছবি
                       * Supabase Storage বা Cloudinary যেকোনোটা থেকে আসতে
                       * পারে, আর কোনো পুরনো সারিতে অন্য host-ও থেকে যেতে
                       * পারে; optimizer-এ গেলে remotePatterns-এ না থাকা
                       * host-এ পুরো পাতাটাই 400 দিয়ে ভাঙে, অথচ এখানে
                       * ছবিটা 78px-এর একটা thumbnail।
                       */
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 78px, 56px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <UtensilsCrossed
                          className="h-5 w-5 text-black/20 md:h-6 md:w-6"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </span>
                    )}
                  </div>

                  {/* Frame 2147236286: column, gap 8, w 204। */}
                  <div className="flex min-w-0 flex-col gap-2 md:w-[204px]">
                    <div className="flex min-w-0 items-center gap-2">
                      {/* ⚠️ ৭৬৮-এর নিচে ellipsis নয়, দুই লাইন — সরু
                          পর্দায় `truncate` মানে প্রায় প্রতিটা নামই
                          কাটা পড়া, আর নামটাই তো সারিটার মূল কথা।
                          ৭৬৮+ এ Figma-র এক-লাইন ফিরে আসে। */}
                      <h4 className="min-w-0 font-frank-ruhl text-[17px] font-medium leading-[1.25] text-[#141921] max-md:line-clamp-2 md:truncate md:text-[20px] md:leading-[1.2]">
                        {item.title}
                      </h4>
                      {!item.isAvailable && (
                        <span className="shrink-0 rounded-full bg-[#FAE7EC] px-2 py-1 font-sora text-[11px] leading-none text-[#D72A37]">
                          Unavailable
                        </span>
                      )}
                    </div>

                    {/* নকশায় ঘরটা 40px উঁচু = ঠিক দুই লাইন (12px × 170%)। */}
                    <p className="line-clamp-2 font-sora text-[12px] font-normal leading-[1.7] text-black/70">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/**
                 * Frame 2147236283: row, gap 12।
                 *
                 * ⚠️ ৭৬৮-এর নিচে দুটো বোতাম `flex-1`, অর্থাৎ কার্ডের
                 * প্রস্থ সমান দুই ভাগে — modal-এর Cancel/Save জোড়ার
                 * হুবহু একই নিয়ম (modal-ui.tsx-এর footer)। স্থির ৮৬px
                 * রাখলে ৩২০px-এ দুটো বোতাম বাঁ দিকে জড়ো হয়ে থাকত আর
                 * ডানে একটা অকারণ ফাঁকা জায়গা পড়ে থাকত — ঠিক যেটা
                 * screenshot-এ দেখা যাচ্ছিল।
                 *
                 * উচ্চতাও ৫০ → ৪০, লেখা ১৬ → ১৪। মোবাইলে বাকি সব
                 * বোতামই এই মাপে (ExportReportButton, তারিখ-pill,
                 * ছাঁকনি-pill — সবগুলোই h-10)।
                 */}
                <div className="flex items-center gap-2 md:shrink-0 md:gap-3">
                  {/* ⚠️ `<Link>` নয় — সম্পাদনার form এখন modal, আলাদা
                      পাতায় নয়। তালিকা ছেড়ে যেতে হয় না, আর ভুল করে
                      খুললে Escape/Cancel-এ কিছুই হারায় না। */}
                  <button
                    type="button"
                    onClick={() => setEditingItem(item)}
                    className={`flex h-10 flex-1 items-center justify-center rounded-full border border-black font-sora text-[14px] font-normal leading-none text-black transition-colors hover:bg-black hover:text-white md:h-[50px] md:w-[86px] md:flex-none md:shrink-0 md:text-[16px] ${FOCUS_RING}`}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setConfirming({ kind: "item", id: item.id, title: item.title })
                    }
                    disabled={isPending}
                    className={`flex h-10 flex-1 items-center justify-center rounded-full bg-[#D72A37] font-sora text-[14px] font-normal leading-none text-white transition-opacity hover:opacity-90 disabled:opacity-50 md:h-[50px] md:w-[86px] md:flex-none md:shrink-0 md:text-[16px] ${FOCUS_RING}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}

          {/**
           * শ্রেণির নিজের কাজ দুটো — নকশার বাইরে, তাই ছোট এবং ডানে
           * চাপানো, যাতে উপরের পদ-কার্ডগুলোর সাথে চোখে গুলিয়ে না যায়।
           * পদহীন শ্রেণির ক্ষেত্রেও দেখা যায়, নাহলে খালি শ্রেণিটা আর
           * মোছাই যেত না।
           */}
          {/**
           * ⚠️ ৪৮০-এর নিচে দুটো বোতাম আলাদা সারিতে, পুরো প্রস্থে।
           * পাশাপাশি বসালে ভাগে পড়ত ~১০৮px, আর "Delete category"
           * ১৪px Sora-তে ৯৩px + padding ৩২ = ১২৫px — আঁটত না, লেখাটা
           * দুই লাইনে ভেঙে বোতামদুটো উঁচু-নিচু হয়ে যেত। ৪৮০+ এ আগের
           * মতোই ডানে চাপানো, নিজের মাপে।
           */}
          <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center min-[480px]:justify-end min-[480px]:gap-3">
            {/* ⚠️ `<Link>` নয় — শ্রেণির নাম বদলানোর form এখন Figma-র
                modal-এ (CategoryFormModal), আলাদা পাতায় নয়। */}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={`flex h-10 w-full shrink-0 items-center justify-center rounded-full border border-black/70 px-4 font-sora text-[13px] font-normal leading-none text-black/70 transition-colors hover:border-black hover:text-black min-[480px]:w-auto min-[480px]:text-[14px] ${FOCUS_RING}`}
            >
              Edit category
            </button>

            <button
              type="button"
              onClick={() => setConfirming({ kind: "category" })}
              disabled={isPending}
              className={`flex h-10 w-full shrink-0 items-center justify-center rounded-full border border-[#D72A37] px-4 font-sora text-[13px] font-normal leading-none text-[#D72A37] transition-colors hover:bg-[#D72A37] hover:text-white disabled:opacity-50 min-[480px]:w-auto min-[480px]:text-[14px] ${FOCUS_RING}`}
            >
              Delete category
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
      {/* ⚠️ শর্তসাপেক্ষে render — modal-টা `item` ছাড়া চলে না, আর
          `editingItem` null হলে পাঠানোর মতো কিছু থাকে না। */}
      {editingItem && (
        <MenuItemFormModal
          open
          onClose={() => setEditingItem(null)}
          item={{
            id: editingItem.id,
            title: editingItem.title,
            description: editingItem.description,
            price: editingItem.price,
            imageUrl: editingItem.imageUrl,
            // পদটা এই সারিরই ভেতরে, তাই শ্রেণিটা নিশ্চিতভাবে এটাই —
            // আলাদা করে query করার কিছু নেই।
            categoryId: id,
            isAvailable: editingItem.isAvailable,
          }}
          categories={categories}
          currency={currency}
        />
      )}

      <CategoryFormModal
        open={editing}
        onClose={() => setEditing(false)}
        category={{ id, name }}
      />

      <ConfirmDialog
        open={confirming !== null}
        title={
          confirming?.kind === "item"
            ? `Delete "${confirming.title}"?`
            : `Delete "${name}"?`
        }
        message={
          confirming?.kind === "item"
            ? "This removes the item from the menu. This cannot be undone."
            : items.length > 0
              ? `This category has ${items.length} menu item${items.length === 1 ? "" : "s"}. You'll need to move or remove them first.`
              : "This cannot be undone."
        }
        confirmLabel="Delete"
        tone="danger"
        pending={isPending}
        onConfirm={() => {
          if (!confirming) return;
          if (confirming.kind === "item") {
            handleDeleteItem(confirming.id, confirming.title);
          } else {
            handleDeleteCategory();
          }
        }}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
