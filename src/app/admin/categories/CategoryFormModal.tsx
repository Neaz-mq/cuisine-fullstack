"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import {
  FIELD,
  LABEL,
  ModalError,
  ModalShell,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
} from "@/components/admin/modal-ui";

/**
 * src/app/admin/categories/CategoryFormModal.tsx
 *
 * Figma Frame 2147236195 — "Add Categories"।
 *
 *   কার্ড     padding 30, gap 40, radius 30, চওড়া 735
 *   ├ মাথা    "Add Categories" (Frank Ruhl 600 28px/114%, −0.01em)
 *   │         + বন্ধ-বোতাম 40×40, BG #F9F6F3, radius 100
 *   ├ ঘর      label Frank Ruhl 500 14px/160% + Fill (h 43, padding 12,
 *   │         radius 12, BG #F9F6F3, লেখা Sora 400 12px/160%)
 *   └ পাদ     row gap 8 — Cancel (border 1px #000, radius 90) আর
 *             Save Change (gradient, radius 100), দুটোই flex-grow 1
 *
 * ⚠️ এর একটা অক্ষরও এই ফাইলে হাতে লেখা হয়নি — খোলস, ঘর, label আর
 * বোতাম চারটেই `components/admin/modal-ui.tsx` থেকে। Staff, Supplier
 * আর Inventory-র modal-ও ওই একই ফাইল থেকে আসে, আর হিসাবটা মিলেও
 * যায়: উপরের মাপগুলো ওখানকার ModalShell-এর মন্তব্যে লেখা Figma Frame
 * 2147236222-এর হুবহু একই সংখ্যা। অর্থাৎ designer একই modal-টাই
 * এখানে আবার ব্যবহার করেছেন, আর কোড-এও সেটাই হওয়া উচিত।
 *
 * ── আলাদা পাতাটার কী হলো ────────────────────────────────────────────
 *
 * ⚠️ আগে "Add Categories" চাপলে `/admin/categories/new` পাতায় যেত —
 * `CategoryForm.tsx`, ধূসর Tailwind ডিফল্ট, নকশার বাইরে (আপনার
 * screenshot-এ ওটাই)। এখন modal, তাই ওই দুটো ফাইল আর ব্যবহৃত হয় না:
 *
 *     src/app/admin/categories/new/page.tsx
 *     src/app/admin/categories/[id]/edit/page.tsx
 *     src/app/admin/categories/CategoryForm.tsx
 *
 * ⚠️ আমি ওগুলো **মুছিনি** — zip-এ ফাইল মোছা যায় না, আর আন্দাজে মোছাও
 * উচিত নয়। যাচাই করে নিজে মুছবেন:
 *
 *     grep -rn "categories/new\|CategoryForm" src/
 *
 * route দুটো থেকে গেলে ক্ষতি নেই, শুধু URL হাতে লিখলে পুরনো ধূসর
 * পাতাটা খোলে — কোনো বোতাম আর ওখানে পাঠায় না।
 */
export type CategoryDraft = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  /** না দিলে "Add Categories"; দিলে সেই শ্রেণির সম্পাদনা। */
  category?: CategoryDraft;
};

export default function CategoryFormModal(props: Props) {
  // বন্ধ থাকলে কিছুই mount হয় না — তাই প্রতিবার খোলা মানে নতুন mount,
  // আর `useState`-এর প্রাথমিক মানই একমাত্র সত্য। হাতে লেখা কোনো
  // "reset" তালিকা রক্ষণাবেক্ষণ করতে হয় না। Supplier/Staff-এর
  // modal-গুলোও ঠিক এভাবেই দুই ভাগে লেখা।
  if (!props.open) return null;
  return <CategoryFormModalContent {...props} />;
}

function CategoryFormModalContent({ open, onClose, category }: Props) {
  const router = useRouter();
  const isEdit = Boolean(category);

  const [name, setName] = useState(category?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a category name.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        isEdit ? `/api/admin/categories/${category!.id}` : "/api/admin/categories",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // API-র নিজের বার্তা — "A category with this name already
        // exists." জাতীয় কারণটা ওখান থেকেই আসে, আর সেটা ঘরের
        // ঠিক উপরে দেখা দরকার, toast-এ নয়।
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }

      onClose();
      router.refresh();
      toast.success(isEdit ? `"${trimmed}" updated.` : `"${trimmed}" added.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      titleId="category-form-title"
      title={isEdit ? "Edit Categories" : "Add Categories"}
      footer={
        /* Frame 2147236023: row, gap 8, উচ্চতা 46, দুটোই flex-grow 1। */
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={`${OUTLINE_BUTTON} flex-1`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={`${PRIMARY_BUTTON} flex-1`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Saving…" : "Save Change"}
          </button>
        </div>
      }
    >
      {error && <ModalError message={error} />}

      <div>
        <label htmlFor="category-name" className={LABEL}>
          Categories Name
        </label>
        <input
          id="category-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          /**
           * ⚠️ Enter চাপলেই submit — ঘর একটাই, তাই "লিখে Enter" ছাড়া
           * অন্য কোনো স্বাভাবিক আচরণ নেই। `<form>` মোড়ক দিলে এটা
           * এমনিতেই পাওয়া যেত, কিন্তু তখন ModalShell-এর footer
           * (কার্ডের সরাসরি সন্তান, children-এর বাইরে) form-এর বাইরে
           * পড়ত আর "Save Change" আর submit বোতাম থাকত না।
           */
          onKeyDown={(event) => {
            if (event.key === "Enter" && !submitting) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Pizza"
          autoFocus
          className={FIELD}
        />
      </div>
    </ModalShell>
  );
}
