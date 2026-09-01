"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import CountryCodeSelect, {
  COUNTRIES,
  DEFAULT_COUNTRY,
  type Country,
} from "@/components/CountryCodeSelect";
import { examplePhone, isValidPhone, toE164 } from "@/lib/phone";
import { SUPPLY_CATEGORIES } from "@/lib/supplier-status";
import {
  FIELD,
  LABEL,
  ModalError,
  ModalShell,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  SelectField,
} from "@/components/admin/modal-ui";

/**
 * src/app/admin/suppliers/SupplierFormModal.tsx
 *
 * Figma-র "Add New Suppliers" — Staff-এর modal-গুলোর হুবহু একই খোলস
 * আর ঘর (components/admin/modal-ui.tsx)।
 *
 *   Company Name  |  Supply Category
 *   Email         |  Phone Number
 *   Address       |  Status
 *   Product Supplied  (chips + "Type.." + "Add +")
 *
 * ── এখানে ছবি upload নেই ────────────────────────────────────────────
 *
 * Staff-এর modal-এ উপরে একটা drop-zone আছে, কারণ কর্মীর ছবি
 * সারিতে দেখানো হয়। Supplier-এ তেমন কোনো ক্ষেত্র নেই, আর Figma-র
 * সরবরাহকারী সারিতেও কোনো ছবি নেই — শুধু নাম আর ইমেইল।
 *
 * ⚠️ Staff-এর মতো খোলার সময় fetch করা হয় না। সরবরাহকারীর সব
 * ক্ষেত্রই তালিকার সারিতে ইতিমধ্যেই আছে, তাই prefill-এর জন্য বাড়তি
 * round-trip অপ্রয়োজনীয়।
 */

export type SupplierDraft = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  products: string[];
  isActive: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** না দিলে "Add New Suppliers"; দিলে সেই সরবরাহকারীর সম্পাদনা। */
  supplier?: SupplierDraft;
};

/**
 * সংরক্ষিত E.164 নম্বর ("+8801303660451") থেকে country + জাতীয় অংশ।
 *
 * ⚠️ সবচেয়ে **লম্বা** মিলটাই নেওয়া হয়, প্রথমটা নয়। dial code-গুলো
 * একে অন্যের উপসর্গ হতে পারে — "+1" (US) আর "+1876" (Jamaica)। প্রথম
 * মিল নিলে প্রতিটা জ্যামাইকান নম্বর US হিসেবে খুলত।
 *
 * ⚠️ পুরনো সরবরাহকারীর নম্বর হাতে লেখা হতে পারে ("01712-345678"),
 * অর্থাৎ E.164 নয়। তখন কোনো dial code মেলে না আর পুরোটা জাতীয় অংশ
 * হিসেবে ঘরে বসে — ব্যবহারকারী দেশ বেছে save করলেই সেটা normalise
 * হয়ে যায়। ডেটা হারায় না, শুধু একবার ছুঁতে হয়।
 */
function splitPhone(stored: string | null): { country: Country; national: string } {
  if (!stored?.startsWith("+")) return { country: DEFAULT_COUNTRY, national: stored ?? "" };

  let best: Country | null = null;
  for (const country of COUNTRIES) {
    if (stored.startsWith(country.dial) && (!best || country.dial.length > best.dial.length)) {
      best = country;
    }
  }
  if (!best) return { country: DEFAULT_COUNTRY, national: stored };
  return { country: best, national: stored.slice(best.dial.length) };
}

export default function SupplierFormModal(props: Props) {
  // বন্ধ থাকলে কিছুই mount হয় না — তাই প্রতিবার খোলা মানে নতুন mount,
  // আর `useState`-এর প্রাথমিক মানই একমাত্র সত্য। হাতে লেখা কোনো
  // "reset" তালিকা রক্ষণাবেক্ষণ করতে হয় না।
  if (!props.open) return null;
  return <SupplierFormModalContent {...props} />;
}

function SupplierFormModalContent({ open, onClose, supplier }: Props) {
  const router = useRouter();
  const isEdit = Boolean(supplier);
  const initialPhone = splitPhone(supplier?.phone ?? null);

  const [name, setName] = useState(supplier?.name ?? "");
  const [category, setCategory] = useState(supplier?.category ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [country, setCountry] = useState<Country>(initialPhone.country);
  const [phone, setPhone] = useState(initialPhone.national);
  const [address, setAddress] = useState(supplier?.address ?? "");
  const [isActive, setIsActive] = useState(supplier?.isActive ?? true);
  const [products, setProducts] = useState<string[]>(supplier?.products ?? []);
  const [productDraft, setProductDraft] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function addProduct() {
    const value = productDraft.trim();
    if (!value) return;
    // ⚠️ একই নাম দুবার নয় — case-insensitive মিল, কারণ "Chicken" আর
    // "chicken" ব্যবহারকারীর কাছে এক জিনিস। মিলে গেলে চুপচাপ উপেক্ষা,
    // কোনো ভুল-বার্তা নয়: এটা ভুল নয়, ইতিমধ্যেই হয়ে যাওয়া কাজ।
    if (!products.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setProducts((prev) => [...prev, value]);
    }
    setProductDraft("");
  }

  async function handleSubmit() {
    setError(null);

    if (!name.trim()) {
      setError("Company name is required.");
      return;
    }

    // ফোন ঐচ্ছিক, কিন্তু দিলে বৈধ হতে হবে — অর্ধেক নম্বর রাখার চেয়ে
    // ফাঁকা রাখা ভালো, কারণ পরে কেউ ওটায় ফোন করার চেষ্টা করবেন।
    let e164 = "";
    if (phone.trim()) {
      e164 = toE164(country.dial, phone);
      if (!isValidPhone(e164)) {
        setError(`That doesn't look like a valid ${country.name} phone number.`);
        return;
      }
    }

    // ⚠️ ঘরে লেখা কিন্তু "Add" না চাপা নামটাও ধরা হয় — নাহলে কেউ
    // "Beef" লিখে সরাসরি Save চাপলে সেটা নীরবে হারিয়ে যেত।
    const pendingDraft = productDraft.trim();
    const finalProducts =
      pendingDraft && !products.some((item) => item.toLowerCase() === pendingDraft.toLowerCase())
        ? [...products, pendingDraft]
        : products;

    setSubmitting(true);
    try {
      const res = await fetch(
        isEdit ? `/api/admin/suppliers/${supplier!.id}` : "/api/admin/suppliers",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            // ⚠️ ফাঁকা string পাঠানো হয়, `null` নয় — schema ঠিক ওটাই
            // গ্রহণ করে (`.or(z.literal(""))`), আর route নিজেই
            // `|| null` করে DB-তে বসায়। null পাঠালে schema reject করত।
            email: email.trim(),
            phone: e164,
            address: address.trim(),
            category,
            products: finalProducts,
            isActive,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      titleId="supplier-form-title"
      title={isEdit ? "Edit Supplier" : "Add New Suppliers"}
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

      {/* Frame 2147236092: প্রতিটা সারি gap 16, সারিগুলোর মাঝে 20। */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
        <div>
          <label htmlFor="supplier-name" className={LABEL}>
            Company Name
          </label>
          <input
            id="supplier-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Fresh Farm Ltd."
            className={FIELD}
          />
        </div>

        <SelectField
          id="supplier-category"
          label="Supply Category"
          value={category}
          onChange={setCategory}
          options={[
            { value: "", label: "— Not set —" },
            ...SUPPLY_CATEGORIES.map((item) => ({ value: item, label: item })),
          ]}
        />

        <div>
          <label htmlFor="supplier-email" className={LABEL}>
            Email
          </label>
          {/* ⚠️ Staff-এর মতো এটা login পরিচয় নয়, তাই edit-এও
              সম্পাদনাযোগ্য। সরবরাহকারীর কোনো account নেই — এটা নিছক
              যোগাযোগের ঠিকানা, আর সেটা বদলাতেই পারে। */}
          <input
            id="supplier-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="hello@dairyfresh.com"
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="supplier-phone" className={LABEL}>
            Phone Number
          </label>
          {/**
           * Figma Frame 2147236090: country block + একটা 1px × 28px
           * #D9D9D9 বিভাজক + নম্বরের ঘর, সব এক "Fill" বাক্সে — Staff-এর
           * modal-এর হুবহু একই গড়ন।
           *
           * ⚠️ CountryCodeSelect-এর নিজের পাড়টা পুরো উচ্চতা জুড়ে যায়,
           * কিন্তু নকশার রেখাটা ২৮px। component-টা register পাতাও
           * ব্যবহার করে, তাই ওখানে হাত না দিয়ে এখানেই পাড়টা নিভিয়ে
           * নিজের রেখা বসানো হলো।
           *
           * overflow-hidden ইচ্ছাকৃতভাবে নেই — থাকলে country dropdown
           * clip হয়ে যেত।
           */}
          <div className="flex h-[43px] items-stretch rounded-[12px] bg-[#F9F6F3] pl-3 focus-within:[outline:2px_solid_#FF9540] focus-within:[outline-offset:-2px]">
            <div className="flex shrink-0 items-stretch [&_button]:border-r-0 [&_button]:px-0 [&_button]:text-[12px]">
              <CountryCodeSelect value={country} onChange={setCountry} />
            </div>
            <span className="my-auto ml-3 h-7 w-px shrink-0 bg-[#D9D9D9]" aria-hidden="true" />
            <input
              id="supplier-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={examplePhone(country.code) || "Phone number"}
              className="min-w-0 flex-1 rounded-r-[12px] bg-transparent px-3 font-sora text-[12px] leading-[1.6] text-black placeholder:text-black/70 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="supplier-address" className={LABEL}>
            Address
          </label>
          <input
            id="supplier-address"
            type="text"
            maxLength={500}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Charmatha, Bogura"
            className={FIELD}
          />
        </div>

        <SelectField
          id="supplier-status"
          label="Status"
          value={isActive ? "active" : "inactive"}
          onChange={(next) => setIsActive(next === "active")}
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />

        {/**
         * Frame 2147236308: label + chip সারি + ("Type.." + "Add +")।
         *
         * ⚠️ Figma-র chip-এ কোনো "×" নেই, কিন্তু এখানে আছে — নাহলে ভুল
         * করে যোগ করা একটা নাম আর কখনো সরানো যেত না, আর তখন ঘরটার
         * একমাত্র শোধরানোর পথ হতো সরবরাহকারীটাই মুছে ফেলা। একটা যোগ
         * করার উপায় থাকলে বাদ দেওয়ারও থাকতে হয়।
         */}
        <div className="md:col-span-2">
          <span className={LABEL}>Product Supplied</span>

          {products.length > 0 && (
            /* Frame 2147236449: row, gap 16 — chip-গুলো cream, উচ্চতা 43,
               radius 12, padding 12, লেখা Sora 12 Black/70।
               `flex-wrap`, কারণ Figma-তে দুটো chip, বাস্তবে দশটাও
               হতে পারে আর তখন সারিটা উপচে যেত। */
            <div className="mb-3 flex flex-wrap gap-2">
              {products.map((product) => (
                <span
                  key={product}
                  className="flex h-[43px] items-center gap-2 rounded-[12px] bg-[#F9F6F3] px-3 font-sora text-[12px] leading-[1.6] text-black/70"
                >
                  {product}
                  <button
                    type="button"
                    onClick={() =>
                      setProducts((prev) => prev.filter((item) => item !== product))
                    }
                    aria-label={`Remove ${product}`}
                    className="text-black/40 transition-colors hover:text-[#D72A37] focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Frame 2147236448: row, gap 16 — ঘরটা flex-grow, "Add"
              বোতামটা hug (cream, উচ্চতা 43, radius 12, gap 6, icon 14)। */}
          <div className="flex gap-2">
            <input
              id="supplier-product"
              type="text"
              maxLength={60}
              value={productDraft}
              onChange={(event) => setProductDraft(event.target.value)}
              // ⚠️ Enter চাপলে যোগ হয়, কিন্তু `preventDefault` জরুরি:
              // নাহলে modal-এর ভেতরে Enter মানে "form submit" ধরা হতো
              // আর অসম্পূর্ণ অবস্থায় save হয়ে যেত।
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addProduct();
                }
              }}
              placeholder="Type.."
              aria-label="Add a product"
              className={FIELD}
            />
            <button
              type="button"
              onClick={addProduct}
              className="flex h-[43px] shrink-0 items-center gap-1.5 rounded-[12px] bg-[#F9F6F3] px-3 font-sora text-[12px] leading-none text-black transition-colors hover:bg-black/[0.06] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]"
            >
              Add
              <Plus className="h-3.5 w-3.5" strokeWidth={1.2} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
