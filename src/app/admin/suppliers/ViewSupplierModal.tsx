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
  ReadOnlyField,
} from "@/components/admin/modal-ui";

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
        title="Supplier Details"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            {supplier && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={pending || loading}
                className={`${isActive ? DANGER_BUTTON : OUTLINE_BUTTON} sm:mr-auto`}
              >
                {isActive ? "Deactivate" : "Reactivate"}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`${OUTLINE_BUTTON} flex-1 sm:flex-none`}
            >
              Close
            </button>

            <button
              type="button"
              onClick={onEdit}
              disabled={loading}
              className={`${PRIMARY_BUTTON} flex-1 sm:flex-none`}
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

              {/* Staff-এর View modal-এর একই চার-কলাম গড়ন। ৫৬০-এর নিচে
                  দুই কলাম, কারণ চার কলামে প্রতিটা ~১৫০px আর ঠিকানা
                  ওতে আঁটে না। */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 min-[560px]:grid-cols-4">
                <ReadOnlyField label="Phone Number" value={supplier.phone ?? "—"} />
                <ReadOnlyField label="Supply Category" value={supplier.category ?? "—"} />
                <ReadOnlyField label="Address" value={supplier.address ?? "—"} />
                {/* ⚠️ pill নয়, সাধারণ লেখা — Staff-এর View modal-এর
                    একই সিদ্ধান্ত। তালিকায় রঙটা কাজ করে কারণ দশটা
                    সারির মধ্যে চোখ বুলিয়ে খুঁজতে হয়; এখানে একজনই। */}
                <ReadOnlyField label="Status" value={isActive ? "Active" : "Inactive"} />
              </div>

              <div>
                <span className="font-sora text-[13px] font-normal leading-none text-black/70">
                  Product Supplied
                </span>
                {/* সারির pill-টা জায়গা বাঁচাতে গুটিয়ে রাখা ("Chicken +1")।
                    এখানে জায়গার টান নেই, তাই পুরো তালিকাটাই দেখানো হয় —
                    এটাই modal-এ আসার একটা কারণ। */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {supplier.products.length === 0 ? (
                    <span className="font-frank-ruhl text-[16px] font-medium text-black">—</span>
                  ) : (
                    supplier.products.map((product) => (
                      <span
                        key={product}
                        className="flex h-9 items-center rounded-full bg-[#F9F6F3] px-3 font-sora text-[12px] leading-none text-black/70"
                      >
                        {product}
                      </span>
                    ))
                  )}
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
