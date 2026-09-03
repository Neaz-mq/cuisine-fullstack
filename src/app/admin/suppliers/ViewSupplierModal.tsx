"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import {
  DANGER_BUTTON,
  ModalError,
  ModalShell,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  READ_ONLY_LABEL,
  ReadOnlyField,
} from "@/components/admin/modal-ui";
import { SupplierProductsPill } from "./SupplierProductsPill";

/**
 * src/app/admin/suppliers/ViewSupplierModal.tsx
 *
 * "Supplier Details" — Staff-এর View modal-এর হুবহু একই খোলস আর
 * একই footer (Deactivate · Close · Edit)।
 *
 * ── এই modal-টা কী **যোগ** করে ──────────────────────────────────────
 *
 * ⚠️ প্রথমে Suppliers সারিতে "View" বোতামই রাখিনি, আর যুক্তিটা ছিল:
 * সরবরাহকারীর সব ঘর সারিতেই দেখা যাচ্ছে (নাম, ইমেইল, ঠিকানা, ফোন,
 * শ্রেণি, পণ্য, status), তাই modal খুললে নতুন কিছু পাওয়া যেত না।
 *
 * সেই যুক্তিটা এখনো ঠিক — তাই এই modal-টা শুধু ওই ঘরগুলো আবার
 * দেখায় না। নিচে একটা "Supply history" অংশ আছে যেটা সারিতে নেই আর
 * থাকতেও পারে না: কতগুলো অর্ডার দেওয়া হয়েছে, শেষ মাল কবে এসেছে,
 * কতগুলো আলাদা পণ্য এসেছে। ওগুলোর জন্য আলাদা query লাগে
 * (GET /api/admin/suppliers/[id]), আর দশটা সারির জন্য দশবার সেই
 * query চালানো অর্থহীন হতো।
 *
 * ⚠️ "Deactivate" এখানে, সারিতে নয় — Staff-এর একই কারণ। ধ্বংসাত্মক
 * কাজ তালিকার ভেতরে রাখলে ভুল সারিতে click হওয়া কেবল সময়ের ব্যাপার;
 * এখানে পৌঁছতে হলে আগে ওই নির্দিষ্ট সরবরাহকারীর তথ্যটা চোখের
 * সামনে আসে।
 */

type SupplierDetails = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  products: string[];
  isActive: boolean;
  createdAt: string;
  purchaseOrderCount: number;
  lastReceivedAt: string | null;
  distinctItemsSupplied: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  supplierId: string;
  /** "Edit" চাপলে — এই modal বন্ধ করে form modal খোলে। */
  onEdit: () => void;
};

/**
 * ⚠️ বন্ধ থাকলে কিছুই mount হয় না।
 *
 * আগে Staff-এর modal-এ একটা effect খোলার সময় state পরিষ্কার করত
 * (`setSupplier(null); setLoading(true); …`), আর lint সেটা ধরেছিল
 * (`react-hooks/set-state-in-effect`)। এখানে সেই ভুলটা শুরুতেই এড়ানো:
 * প্রতিবার খোলা মানে নতুন mount, আর `useState`-এর প্রাথমিক মানই
 * একমাত্র সত্য।
 */
export default function ViewSupplierModal(props: Props) {
  if (!props.open) return null;
  return <ViewSupplierModalContent {...props} />;
}

function ViewSupplierModalContent({ open, onClose, supplierId, onEdit }: Props) {
  const router = useRouter();

  const [supplier, setSupplier] = useState<SupplierDetails | null>(null);
  // শুরুতেই `true` — ডেটা আসার আগে দেখানোর কিছু নেই।
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // ⚠️ effect-এর শরীরে সরাসরি কোনো setState নেই — সবগুলো এই async
    // function-এর ভেতরে, প্রথম `await`-এর পরে।
    (async () => {
      try {
        const res = await fetch(`/api/admin/suppliers/${supplierId}`);
        if (cancelled) return;
        if (!res.ok) {
          setError("Couldn't load this supplier.");
          setLoading(false);
          return;
        }
        const data = (await res.json()) as SupplierDetails;
        if (cancelled) return;
        setSupplier(data);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Something went wrong. Please try again.");
          setLoading(false);
        }
      }
    })();

    // অন্য একজনের View চাপলে আগের fetch পরে ফিরে এসে ভুল
    // সরবরাহকারীর তথ্য বসিয়ে দিত — এই পতাকাটা সেটাই আটকায়।
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  const isActive = supplier?.isActive ?? true;

  /**
   * ⚠️ browser-এর `confirm()` নয় — ConfirmDialog।
   *
   * বিস্তারিত components/admin/ConfirmDialog.tsx-এ। সবচেয়ে বড় কারণ:
   * `confirm()`-এ প্রাথমিক focus থাকে **OK**-তে, অর্থাৎ Deactivate
   * চেপে অভ্যাসবশত Enter চাপলেই কাজটা হয়ে যেত।
   */
  async function toggleActive() {
    if (!supplier) return;
    const next = !isActive;

    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Couldn't ${next ? "reactivate" : "deactivate"} this supplier.`);
        // dialog বন্ধ করে ভুলটা modal-এর ভেতরে দেখানো হয় — dialog-এর
        // ভেতরে দেখালে ব্যবহারকারী "আবার চেষ্টা করব না বাতিল করব"
        // সিদ্ধান্তে আটকে থাকতেন, আর পেছনের তথ্যটাও ঢাকা পড়ত।
        setConfirmOpen(false);
        setPending(false);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setConfirmOpen(false);
      setPending(false);
    }
  }

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        titleId="supplier-view-title"
        /* ⚠️ Figma-তে বহুবচন — "Suppliers Details"। ইংরেজিতে এটা
           একটু কানে লাগে ("Supplier Details" হওয়ার কথা), কিন্তু
           Figma-ই এখানে শেষ কথা। ভুল মনে হলে বলবেন, এক শব্দের বদল। */
        title="Suppliers Details"
        footer={
          /**
           * ⚠️ তিনটে বোতাম **সব পর্দাতেই এক সারিতে** (Figma-র ৩২০px
           * frame-এও, Frame 2147236669: row, gap 8)।
           *
           * এখানে আমি একবার ভুল করেছিলাম: `sm:flex-row`-কে
           * `min-[640px]:flex-row` করে ৬৪০-এর নিচে উপর-নিচে বসিয়ে
           * দিয়েছিলাম, এই হিসাবে যে ১৩৩ + ৯৯.৫ + ৯৭.৫ = ৩৩০px
           * ৩২০px-এর পর্দায় ধরে না। হিসাবটা তখনকার বোতামের মাপে ঠিক
           * ছিল, কিন্তু ওই একই দফায় বোতামের ধ্রুবকগুলো ৬৪০-এর নিচে
           * ১৪px + px-3 করা হয়েছে — তাতে মাপ দাঁড়ায়:
           *
           *   Deactivate 102.1 + Close 65.3 + Edit 52.7 = 220.2
           *   জায়গা 256 − দুটো gap (16) = 240  ✅
           *
           * অর্থাৎ শর্তটা আর খাটে না, আর খাড়া করার দরকারও নেই।
           */
          <div className="flex flex-row gap-2">
            {supplier && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={pending || loading}
                className={`${isActive ? DANGER_BUTTON : OUTLINE_BUTTON} min-[640px]:mr-auto`}
              >
                {isActive ? "Deactivate" : "Reactivate"}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`${OUTLINE_BUTTON} flex-1 min-[640px]:flex-none`}
            >
              Close
            </button>

            <button
              type="button"
              onClick={onEdit}
              disabled={loading}
              className={`${PRIMARY_BUTTON} flex-1 min-[640px]:flex-none`}
            >
              Edit
            </button>
          </div>
        }
      >
        {error && <ModalError message={error} />}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-black/40" aria-hidden="true" />
          </div>
        ) : (
          supplier && (
            <>
              {/* পরিচয়ের ব্লক — Staff modal-এর মতোই cream কার্ড, শুধু
                  ছবি ছাড়া (সরবরাহকারীর কোনো ছবি-ঘর নেই)। */}
              <div className="flex flex-col gap-1 rounded-[16px] bg-[#F9F6F3] p-4">
                <p className="font-frank-ruhl text-[20px] font-medium leading-[1.2] text-black">
                  {supplier.name}
                </p>
                <p className="font-sora text-[12px] leading-[1.7] text-black/70">
                  {supplier.email ?? "No email on file"}
                </p>
              </div>

              {/**
               * Figma Frame 2147236668 — ঘরগুলো।
               *
               * ⚠️ এটা চার কলামের এক সারি নয়, **তিন কলাম আর দুই সারি**,
               * আর কলামগুলো `justify-content: space-between` দিয়ে ছড়ানো:
               *
               *   Address   | Phone Number | Category
               *   Products  | Status       |
               *
               * grid দিয়ে সমান তিন ভাগ করলে কলামগুলো বসত 0 / 225 / 450-এ,
               * অথচ Figma-র নিজের মাপে (কলাম 115 · 142 · 81, মোট 675)
               * space-between-এর ফাঁক দাঁড়ায় (675 − 338)/2 = 168.5,
               * অর্থাৎ শুরুর বিন্দু 0 / 283.5 / 594 — "Category" প্রায়
               * ডান কিনারায়। তাই ৫৬০ থেকে flex + space-between, আর
               * প্রতিটা কলাম নিজের লেখার মাপে দাঁড়ায়।
               *
               * ⚠️ মোড়ক তিনটেয় base-এ `contents` — ৫৬০-এর নিচে ওরা
               * নিজেরা কোনো বাক্স থাকে না, ভেতরের পাঁচটা ঘর সরাসরি
               * দুই-কলামের grid-এ ছড়িয়ে পড়ে। কলামে-ভাগ করা গড়নটা
               * ছোট পর্দায় অর্থহীন, অথচ মোড়ক থাকলে ওরা তিনটে ব্লকে
               * আটকে থাকত।
               */}
              {/**
               * ⚠️ ৩২০px-এ ভাগটা ট্যাবলেটের থেকে আলাদা (Figma Frame
               * 2147236693 — দুই কলাম):
               *
               *   Address   | Phone Number
               *   Category  | Status
               *   Products  |
               *
               * মোড়ক তিনটে তখন `contents`, তাই পাঁচটা ঘরই এই grid-এর
               * সরাসরি ঘর আর অবস্থান ঠিক করে নিজের `col-start`/
               * `row-start` — মোড়কের সদস্যতালিকা ছোঁয়ার দরকার নেই।
               * (সারির কার্ডে ঠিক এই জায়গাটাতেই একবার ঘর সরিয়ে
               * ট্যাবলেট ভেঙেছিলাম।)
               *
               * ⚠️ কলাম দুটো ঠিক আধাআধি নয়, `124fr : 117fr`। Figma-তে
               * দুটোই ১০৬ (মোট ২১২), কিন্তু ওই frame-টা আসলে ০.৬৯৯
               * মাপে ছোট করা — তার সত্যিকারের প্রস্থ ৩৪৯px, যা ৩২০px
               * পর্দায় হওয়াই সম্ভব নয়। আমাদের ২৫৬px-এ আধাআধি করলে
               * প্রতিটা ১২৪ (gap 8 বাদে), অথচ বাঁ কলামে
               * "Charmatha, Bogura" ১৪px-এ ১২৪.৪ — ০.৪px-এর জন্য
               * কেটে যেত। অনুপাতে ভাগ করলে ১২৭.৬ আর ১২০.৪ (দরকার
               * ১১৬.৮), দুদিকেই স্বস্তি।
               */}
              <div className="grid grid-cols-[minmax(0,124fr)_minmax(0,117fr)] gap-x-2 gap-y-5 min-[560px]:flex min-[560px]:justify-between min-[560px]:gap-x-6">
                <div className="contents min-[560px]:flex min-[560px]:min-w-0 min-[560px]:flex-col min-[560px]:gap-5">
                  <ReadOnlyField
                    className="col-start-1 row-start-1"
                    label="Address"
                    value={supplier.address ?? "—"}
                  />

                  {/**
                   * ⚠️ ReadOnlyField ব্যবহার করা গেল না, কারণ ওটার মান
                   * একটা string — এখানে মানটা একটা গুটিয়ে রাখা pill।
                   * শিরোনামটা তবু হুবহু একই দেখাতে হয়, তাই ক্লাসগুলো
                   * দুবার না লিখে READ_ONLY_LABEL থেকে আসছে।
                   *
                   * ⚠️ আগে এখানে প্রতিটা পণ্যের জন্য আলাদা cream pill
                   * সাজানো ছিল ("Chicken", "Beef" পাশাপাশি), এই যুক্তিতে
                   * যে modal-এ জায়গার টান নেই তাই পুরো তালিকা দেখানো
                   * যায়। যুক্তিটা মন্দ ছিল না, কিন্তু Figma-তে ঘরটা
                   * সারির মতোই একটাই pill + chevron (Frame 2147236298),
                   * আর তাতে দুটো জায়গায় একই জিনিস একইরকম দেখায় —
                   * chevron চাপলে পুরো তালিকাটা এমনিতেই খোলে।
                   */}
                  <div className="col-start-1 row-start-3 flex min-w-0 flex-col gap-2 min-[560px]:gap-3">
                    <span className={READ_ONLY_LABEL}>Products</span>
                    <SupplierProductsPill products={supplier.products} surface="cream" />
                  </div>
                </div>

                <div className="contents min-[560px]:flex min-[560px]:min-w-0 min-[560px]:flex-col min-[560px]:gap-5">
                  <ReadOnlyField
                    className="col-start-2 row-start-1"
                    label="Phone Number"
                    value={supplier.phone ?? "—"}
                  />
                  {/**
                   * ⚠️ এখন pill, সাধারণ লেখা নয় — আগের সিদ্ধান্তটা উল্টে।
                   * তখনকার যুক্তি ছিল "তালিকায় রঙটা কাজ করে কারণ দশটা
                   * সারির মধ্যে চোখ বুলিয়ে খুঁজতে হয়; এখানে একজনই"।
                   * কিন্তু Figma-র Frame 2147236297 স্পষ্ট: Fill,
                   * background #E8FFEC, লেখা #0ECF00 — অর্থাৎ designer
                   * এখানেও pill-ই চেয়েছেন।
                   */}
                  <ReadOnlyField
                    className="col-start-2 row-start-2"
                    label="Status"
                    value={isActive ? "Active" : "Inactive"}
                    tone={isActive ? "positive" : "negative"}
                  />
                </div>

                <div className="contents min-[560px]:flex min-[560px]:min-w-0 min-[560px]:flex-col min-[560px]:gap-5">
                  {/* ⚠️ Figma-তে শিরোনামটা শুধু "Category", "Supply
                      Category" নয় (Frame 2147236666-এর label, w=67)। */}
                  <ReadOnlyField
                    className="col-start-1 row-start-2"
                    label="Category"
                    value={supplier.category ?? "—"}
                  />
                </div>
              </div>

              {/* ── এই অংশটাই modal-টার আসল কারণ ────────────────────
                  উপরের ঘরগুলো সারিতেও আছে; নিচের তিনটে নেই। */}
              <div className="border-t border-black/10 pt-5">
                <p className="mb-4 font-sora text-[13px] font-normal leading-none text-black/70">
                  Supply history
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-5 min-[560px]:grid-cols-4">
                  <ReadOnlyField
                    label="Purchase Orders"
                    value={String(supplier.purchaseOrderCount)}
                  />
                  <ReadOnlyField
                    label="Items Supplied"
                    value={String(supplier.distinctItemsSupplied)}
                  />
                  <ReadOnlyField
                    label="Last Delivery"
                    value={formatDate(supplier.lastReceivedAt)}
                  />
                  <ReadOnlyField label="Added On" value={formatDate(supplier.createdAt)} />
                </div>
              </div>
            </>
          )
        )}
      </ModalShell>

      {/* ⚠️ ModalShell-এর **বাইরে**। ভেতরে বসালে এটা modal কার্ডের
          DOM-এর অংশ হতো, আর কার্ডের stacking এটাকে ভেতরে আটকে রাখত। */}
      <ConfirmDialog
        open={confirmOpen}
        tone={isActive ? "danger" : "primary"}
        title={isActive ? "Deactivate this supplier?" : "Reactivate this supplier?"}
        message={
          isActive
            ? `${supplier?.name ?? "They"} will stop showing up when you raise new purchase orders. Past orders and history stay intact, and you can reactivate them any time.`
            : `${supplier?.name ?? "They"} will show up again when raising purchase orders.`
        }
        confirmLabel={isActive ? "Yes, deactivate" : "Yes, reactivate"}
        pending={pending}
        onConfirm={toggleActive}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
