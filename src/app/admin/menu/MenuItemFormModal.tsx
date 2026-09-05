"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import {
  FIELD,
  ImageDropzone,
  LABEL,
  ModalError,
  ModalShell,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  SelectField,
  TEXTAREA,
} from "@/components/admin/modal-ui";

/**
 * src/app/admin/menu/MenuItemFormModal.tsx
 *
 * একটা পদ সম্পাদনার form — `/admin/menu/<id>/edit` পাতার বদলে,
 * প্রজেক্টের বাকি modal-গুলোর হুবহু একই খোলসে
 * (`components/admin/modal-ui.tsx` → Figma Frame 2147236222)।
 *
 *   Title                        (পুরো প্রস্থ)
 *   Description                  (পুরো প্রস্থ, বহু-লাইন)
 *   Price          | Category    (৭৬৮+ এ পাশাপাশি)
 *   Availability   |             (৭৬৮+ এ পাশাপাশি)
 *   Image                        (পুরো প্রস্থ, drop-zone)
 *
 * ⚠️ খোলস, ঘর, label, dropdown, drop-zone আর বোতাম — একটাও এই ফাইলে
 * হাতে লেখা হয়নি। Staff/Supplier/Inventory/Category-র modal-ও ওই একই
 * ফাইল থেকে আসে, আর কারণটা ওখানেই লেখা: এই প্রজেক্টেই একবার কপি করা
 * dropdown নীরবে পিছিয়ে পড়েছিল।
 *
 * ── কী কী ইচ্ছাকৃতভাবে আলাদা ────────────────────────────────────────
 *
 * ⚠️ `<select>` নয়, `SelectField` — native dropdown-এর **খোলা
 * তালিকাটা** browser আঁকে, CSS পৌঁছয় না। পুরনো পাতাটায় ওটাই ছিল, আর
 * ঠিক ওখানেই modal-টা অন্য দশকের widget হয়ে যেত।
 *
 * ⚠️ "Available for order" checkbox-টা এখন একটা দুই-মানের dropdown
 * (Available / Unavailable) — Supplier-এর "Status" ঘরের হুবহু নকল।
 * নকশার ব্যবস্থায় কোনো checkbox নেই, আর একটা খালি বাক্সের চেয়ে
 * লেখা দুটো মান পড়তে সহজ।
 *
 * ⚠️ RECIPE অংশটা এখানে **নেই**, ইচ্ছাকৃতভাবে। ওটা নিজেই একটা তালিকা-
 * form (উপকরণ যোগ/বাদ, পরিমাণ, একক) আর তার নিজের save বোতাম — modal-এর
 * ভেতরে ঢোকালে দুটো আলাদা save একই কার্ডে বসত, আর কোনটা কী সংরক্ষণ
 * করছে সেটা আর বোঝা যেত না। Recipe আগের মতোই
 * `/admin/menu/<id>/edit`-এ, যেখানে `/admin/menu` থেকে পৌঁছনো যায়।
 *
 * ⚠️ দাম নেওয়া হয় **major unit**-এ (12.99), পয়সায় নয় — `MenuItem.price`
 * ওভাবেই সংরক্ষিত আর `priceSchema`-ও তাই আশা করে।
 */

export type MenuItemDraft = {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string | null;
  categoryId: string;
  isAvailable: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  item: MenuItemDraft;
  /** সব শ্রেণি — Category dropdown-এর জন্য। */
  categories: readonly { value: string; label: string }[];
  /** দামের ঘরের গায়ে দেখানোর জন্য, যেমন "USD"। */
  currency?: string;
};

export default function MenuItemFormModal(props: Props) {
  // বন্ধ থাকলে কিছুই mount হয় না — তাই প্রতিবার খোলা মানে নতুন mount,
  // আর `useState`-এর প্রাথমিক মানই একমাত্র সত্য। Supplier/Staff/Category-র
  // modal-গুলোও ঠিক এভাবেই দুই ভাগে লেখা।
  if (!props.open) return null;
  return <MenuItemFormModalContent {...props} />;
}

function MenuItemFormModalContent({ open, onClose, item, categories, currency }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  // string, number নয় — অর্ধেক লেখা "12." বা খালি ঘরকে number দিয়ে
  // ধরা যায় না, আর `NaN` বসালে ঘরটা নীরবে ফাঁকা হয়ে যেত।
  const [price, setPrice] = useState(String(item.price));
  const [categoryId, setCategoryId] = useState(item.categoryId);
  const [isAvailable, setIsAvailable] = useState(item.isAvailable);
  const [imageUrl, setImageUrl] = useState<string | null>(item.imageUrl);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const parsedPrice = Number(price);

    if (!trimmedTitle) return setError("Please enter a title.");
    if (!trimmedDescription) return setError("Please enter a description.");
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return setError("Please enter a valid price.");
    }
    if (!categoryId) return setError("Please choose a category.");

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/menu-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDescription,
          price: parsedPrice,
          /**
           * ⚠️ ছবি সরালে `null` নয়, খালি string। `updateMenuItemSchema`-য়
           * `imageUrl` হলো `z.url().optional().or(z.literal(""))` —
           * অর্থাৎ null ওখানে **বৈধ নয়**, 400 ফিরত। পুরনো
           * MenuItemForm-এ `|| null` লেখা আছে, তাই ওই পাতা থেকে ছবি
           * মোছার চেষ্টা করলে আজও নীরবে ব্যর্থ হয়।
           *
           * খালি string সব জায়গাতেই falsy, তাই তালিকা আর কার্ডগুলোয়
           * ছবিহীন অবস্থাটা আগের মতোই দেখায়।
           */
          imageUrl: imageUrl ?? "",
          categoryId,
          isAvailable,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }

      onClose();
      router.refresh();
      toast.success(`"${trimmedTitle}" updated.`);
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
      titleId="menu-item-form-title"
      title="Edit Menu Item"
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
            // ⚠️ upload চলাকালীনও বন্ধ — নাহলে ছবি ওঠার আগেই save হয়ে
            // যেত আর পুরনো URL-টাই সংরক্ষিত থাকত, অথচ পর্দায় নতুন ছবির
            // preview দেখা যেত।
            disabled={submitting || uploading}
            className={`${PRIMARY_BUTTON} flex-1`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Saving…" : "Save Change"}
          </button>
        </div>
      }
    >
      {error && <ModalError message={error} />}

      {/* Frame 2147236092: প্রতিটা সারি gap 16, সারিগুলোর মাঝে 20। */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="menu-item-title" className={LABEL}>
            Title
          </label>
          <input
            id="menu-item-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Crispy French Fries"
            className={FIELD}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="menu-item-description" className={LABEL}>
            Description
          </label>
          <textarea
            id="menu-item-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Golden, crispy, and perfectly salted french fries."
            className={TEXTAREA}
          />
        </div>

        <div>
          <label htmlFor="menu-item-price" className={LABEL}>
            Price{currency ? ` (${currency})` : ""}
          </label>
          <div className="relative">
            {/**
             * ⚠️ ISO code, "$" চিহ্ন নয় — রেস্তোরাঁটা ডলারে দাম নাও রাখতে
             * পারে, আর যে একটামাত্র পর্দায় দাম **বসানো** হয় সেখানেই ভুল
             * চিহ্ন দেখালে ভুল দাম টাইপ হয়। পুরনো form-এও একই কথা লেখা।
             */}
            {currency && (
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-sora text-[11px] text-black/50">
                {currency}
              </span>
            )}
            <input
              id="menu-item-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="8.99"
              className={`${FIELD} ${currency ? "pl-12" : ""}`}
            />
          </div>
        </div>

        <SelectField
          id="menu-item-category"
          label="Category"
          value={categoryId}
          onChange={setCategoryId}
          options={categories}
        />

        <SelectField
          id="menu-item-availability"
          label="Availability"
          value={isAvailable ? "available" : "unavailable"}
          onChange={(next) => setIsAvailable(next === "available")}
          options={[
            { value: "available", label: "Available" },
            { value: "unavailable", label: "Unavailable" },
          ]}
        />

        <div className="md:col-span-2">
          <span className={LABEL}>Image</span>
          <ImageDropzone
            value={imageUrl}
            onChange={setImageUrl}
            onError={setError}
            uploading={uploading}
            setUploading={setUploading}
          />
        </div>
      </div>
    </ModalShell>
  );
}
