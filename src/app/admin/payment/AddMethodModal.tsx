"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

/**
 * Figma "Frame 2147236222" — "Add Payment Method" / "Add Shipping Method"।
 *
 *   735 × auto, সাদা, radius 30, padding 30, ভেতরে gap 40
 *   শিরোনাম 28px | ডানে 40px cream × বোতাম
 *   "Method Name" লেবেল + cream ঘর (radius 12, padding 12)
 *   নিচে "Cancel" (কালো outline) · "Save Change" (gradient)
 *
 * ⚠️ একটাই component, দুটো নয় — payment আর shipping-এর modal দুটোর
 * পার্থক্য কেবল শিরোনাম, placeholder আর `kind`। আলাদা দুটো ফাইল রাখলে
 * একটায় bug ঠিক করে অন্যটায় ভুলে যাওয়া নিশ্চিত ছিল।
 *
 * ⚠️ `<dialog>` element — Esc, backdrop ক্লিক আর focus আটকে রাখা
 * browser নিজেই দেয়; div দিয়ে এর প্রতিটাই হাতে লিখতে হতো।
 */
export default function AddMethodModal({
  kind,
  label,
}: {
  kind: "PAYMENT" | "SHIPPING";
  /** "Payment" বা "Shipping" — শিরোনাম আর aria-label দুটোতেই বসে। */
  label: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  /**
   * Esc-এ browser নিজেই dialog বন্ধ করে, কিন্তু React-এর state সেটা
   * জানে না — `close` event ধরে না মেলালে state আর DOM আলাদা হয়ে যেত
   * আর বোতামটা দ্বিতীয়বার কাজ করত না।
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => setOpen(false);
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/transaction-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name: trimmed }),
      });

      if (!res.ok) {
        // server-এর নিজের বার্তাটাই দেখানো হয় — "আগে থেকেই আছে" বা
        // "নামটা খুব লম্বা" ছাড়া staff বুঝতেই পারতেন না কী করতে হবে।
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't save this method.");
      }

      toast.success(`${trimmed} added.`);
      setName("");
      setOpen(false);
      // server component-টা নতুন সারিটা নিয়ে আবার render হয়।
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this method.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Figma-র gradient pill: "Add Method" + একটা যোগ চিহ্ন। */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[13px] font-semibold leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] min-[480px]:h-11 min-[480px]:text-[14px]"
      >
        Add Method
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`add-method-title-${kind}`}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        className="m-auto w-[calc(100vw-32px)] max-w-[735px] rounded-[20px] bg-white p-0 backdrop:bg-black/50 md:rounded-[30px]"
      >
        <div className="flex flex-col gap-6 p-5 md:gap-10 md:p-[30px]">
          <div className="flex flex-col gap-5 md:gap-6">
            <div className="flex items-center justify-between gap-4">
              <h2
                id={`add-method-title-${kind}`}
                className="font-frank-ruhl text-[22px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[28px]"
              >
                Add {label} Method
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

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`method-name-${kind}`}
                className="font-frank-ruhl text-[14px] font-medium leading-[1.6] text-black"
              >
                Method Name
              </label>
              <input
                id={`method-name-${kind}`}
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                /* Enter চাপলেই সংরক্ষণ — ছোট একটা ঘরের জন্য মাউস ধরার
                   দরকার নেই। */
                onKeyDown={(event) => {
                  if (event.key === "Enter") save();
                }}
                maxLength={40}
                placeholder={kind === "PAYMENT" ? "Banking" : "Our Own Delivery"}
                /* ১৬px — iOS Safari তার কম font-size-এর ঘরে ট্যাপ করলে
                   পুরো পাতা zoom করে দেয়। */
                className="h-[43px] w-full rounded-[12px] bg-[#F9F6F3] px-3 font-sora text-[16px] leading-none text-black placeholder:text-[12px] placeholder:text-black/70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]"
              />
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
              /* ফাঁকা নামে নিষ্ক্রিয় — server-ও সেটা নেবে না, তাই এখানে
                 আটকানো মানে একটা অকারণ round trip আর একটা error কম। */
              disabled={saving || name.trim().length === 0}
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
