"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import type { TransactionMethod } from "@/lib/transaction-methods";

/**
 * Figma "Frame 2147236222"-এর খোলসে মাধ্যম ব্যবস্থাপনার modal।
 *
 * ⚠️ Figma-তে বোতামটার নাম "Add Method" আর ভেতরে একটা ফাঁকা ঘর — যেন
 * নাম লিখেই নতুন একটা মাধ্যম বানানো যায়। সেটা করা হয়নি, আর কারণটা
 * src/lib/transaction-methods.ts-এর মাথায় বিস্তারিত লেখা: একটা নাম
 * checkout-এ অপশন, টাকা নেওয়ার integration, webhook বা ফেরতের পথ —
 * কোনোটাই তৈরি করে না। ফলে যোগ করা নামটা চিরকাল শূন্য লেনদেন নিয়ে বসে
 * থাকত, আর staff ভাবতেন মাধ্যমটা চালু আছে।
 *
 * তাই বোতামের কাজটা বদলেছে (নাম "Manage Methods"), কিন্তু খোলসটা
 * Figma-রই: 735px, radius 30, padding 30, নিচে Cancel · Save Change।
 * এটাই Shopify/WooCommerce-এর আচরণ — তালিকা দেওয়া থাকে, admin কেবল
 * নাম আর চালু/বন্ধ বদলান।
 */
export default function MethodManagerModal({
  kind,
  label,
  methods,
}: {
  kind: "PAYMENT" | "SHIPPING";
  /** "Payment" বা "Shipping" — শিরোনামে বসে। */
  label: string;
  methods: TransactionMethod[];
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(methods);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Esc-এ browser নিজেই বন্ধ করে; state না মেলালে বোতামটা দ্বিতীয়বার
    // কাজ করত না।
    const handleClose = () => setOpen(false);
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  function openModal() {
    // ⚠️ প্রতিবার খোলার সময় server-এর মান থেকে শুরু। আগে একবার বদলে
    // Cancel চাপা হয়ে থাকলে সেই অর্ধেক-লেখা খসড়াটা ফিরে আসা উচিত নয়।
    setDraft(methods);
    setOpen(true);
  }

  function update(code: string, patch: Partial<TransactionMethod>) {
    setDraft((prev) =>
      prev.map((method) => (method.code === code ? { ...method, ...patch } : method))
    );
  }

  async function save() {
    if (saving) return;

    if (draft.some((method) => method.label.trim().length === 0)) {
      toast.error("Every method needs a name.");
      return;
    }

    // server-ও এটা আটকায়; এখানে আটকানো মানে একটা অকারণ round trip কম।
    if (kind === "PAYMENT" && !draft.some((method) => method.enabled)) {
      toast.error("Keep at least one payment method switched on.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/transaction-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          methods: draft.map((method) => ({
            code: method.code,
            label: method.label.trim(),
            enabled: method.enabled,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't save these methods.");
      }

      toast.success("Methods updated.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save these methods.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[13px] font-semibold leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] min-[480px]:h-11 min-[480px]:text-[14px]"
      >
        Manage Methods
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
          <circle cx="16" cy="8" r="2" />
          <circle cx="10" cy="16" r="2" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`methods-title-${kind}`}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        className="m-auto w-[calc(100vw-32px)] max-w-[735px] rounded-[20px] bg-white p-0 backdrop:bg-black/50 md:rounded-[30px]"
      >
        <div className="flex flex-col gap-6 p-5 md:gap-10 md:p-[30px]">
          <div className="flex flex-col gap-5 md:gap-6">
            <div className="flex items-center justify-between gap-4">
              <h2
                id={`methods-title-${kind}`}
                className="font-frank-ruhl text-[22px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[28px]"
              >
                {label} Methods
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3] text-black transition-colors hover:bg-black/10 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
              >
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <p className="font-sora text-[12px] leading-[1.6] text-black/70">
              {kind === "PAYMENT"
                ? "Rename what customers see at checkout, or switch a method off to stop accepting it."
                : "Rename what these delivery partners are called across the admin and the customer's order page."}
            </p>

            <div className="flex flex-col gap-3">
              {draft.map((method) => (
                <div
                  key={method.code}
                  className="flex flex-col gap-3 rounded-[16px] bg-[#F9F6F3] p-4 min-[560px]:flex-row min-[560px]:items-end"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <label
                      htmlFor={`method-${kind}-${method.code}`}
                      className="font-frank-ruhl text-[14px] font-medium leading-[1.6] text-black"
                    >
                      Method Name
                    </label>
                    <input
                      id={`method-${kind}-${method.code}`}
                      type="text"
                      value={method.label}
                      onChange={(event) => update(method.code, { label: event.target.value })}
                      maxLength={40}
                      /* ১৬px — iOS Safari তার কম font-size-এর ঘরে ট্যাপ
                         করলে পুরো পাতা zoom করে দেয়। */
                      className="h-[43px] w-full rounded-[12px] bg-white px-3 font-sora text-[16px] leading-none text-black focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]"
                    />
                  </div>

                  {kind === "PAYMENT" && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={method.enabled}
                      onClick={() => update(method.code, { enabled: !method.enabled })}
                      className={`flex h-[43px] shrink-0 items-center gap-3 rounded-full px-4 font-sora text-[13px] font-semibold leading-none transition-colors focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] ${
                        method.enabled ? "bg-[#E8FFEC] text-[#0ECF00]" : "bg-black/5 text-black/50"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-9 items-center rounded-full p-[2px] transition-colors ${
                          method.enabled ? "bg-[#0ECF00]" : "bg-black/25"
                        }`}
                      >
                        <span
                          className={`h-4 w-4 rounded-full bg-white transition-transform ${
                            method.enabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </span>
                      {method.enabled ? "On" : "Off"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 min-[420px]:flex-row">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-[46px] flex-1 items-center justify-center rounded-full border border-black px-5 font-sora text-[15px] font-semibold leading-none text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] md:text-[16px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex h-[46px] flex-1 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-5 font-sora text-[15px] font-semibold leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:opacity-50 md:text-[16px]"
            >
              {saving ? "Saving…" : "Save Change"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
