"use client";

import { useState } from "react";
import { toast } from "react-toastify";

/**
 * Profile Details → the email switches (Figma "Preferences" card).
 *
 *   Order Updates        — emails when the order is on its way, delivered
 *                          or cancelled (lib/send-order-status-email.ts)
 *   Promotions & Offers  — deals and coupon emails: the same opt-in as the
 *                          checkout checkbox, synced to the Resend list that
 *                          /admin/marketing sends to
 *
 * Only switches that really change something are here. Figma's "Product
 * Recommendations" and the "turn all on/off" switch were taken out: the app
 * has no personal-suggestion feature for them to control.
 *
 * Each switch saves straight away, like every phone settings screen — no
 * Save button. It flips at once and flips back with a message if saving
 * fails.
 */

export type PreferenceValues = {
  orderUpdates: boolean;
  marketingConsent: boolean;
};

type Key = keyof PreferenceValues;

const ROWS: { key: Key; title: string; description: string }[] = [
  { key: "orderUpdates", title: "Order Updates", description: "Email notifications for order status" },
  { key: "marketingConsent", title: "Promotions & Offers", description: "Deals, coupon codes and member offers by email" },
];

/** Figma switch: 72×42 pill, 6px padding, 30px white knob. */
function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[42px] w-[72px] shrink-0 rounded-full transition-colors focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-wait ${
        checked ? "bg-[#FF9540]" : "bg-[rgba(255,149,64,0.4)]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-[6px] h-[30px] w-[30px] rounded-full bg-white shadow-sm transition-[left] duration-200 ${
          checked ? "left-[36px]" : "left-[6px]"
        }`}
      />
    </button>
  );
}

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] bg-[#F9F6F3] px-4 py-4 md:px-[30px] md:py-5">
      <div className="flex min-w-0 flex-col gap-2.5">
        <p className="font-frank-ruhl text-[20px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[24px]">
          {title}
        </p>
        <p className="font-sora text-[13px] leading-[1.3] tracking-[-0.01em] text-black/70 md:text-[16px]">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

export default function PreferencesCard({ initial }: { initial: PreferenceValues }) {
  const [values, setValues] = useState<PreferenceValues>(initial);
  const [saving, setSaving] = useState(false);

  const save = async (change: Partial<PreferenceValues>) => {
    const before = values;
    setValues({ ...values, ...change });
    setSaving(true);
    try {
      const res = await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setValues(before);
        toast.error(data?.error ?? "Couldn't save this setting. Please try again.");
        return;
      }
      setValues({
        orderUpdates: Boolean(data.orderUpdates),
        marketingConsent: Boolean(data.marketingConsent),
      });
      toast.success("Preference saved");
    } catch {
      setValues(before);
      toast.error("No connection. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      id="preferences"
      aria-label="Notification preferences"
      className="flex scroll-mt-6 flex-col gap-4 rounded-[24px] bg-white p-5 md:rounded-[30px] md:p-[30px]"
    >
      <div className="flex flex-col gap-2 pb-1">
        <h2 className="font-frank-ruhl text-[22px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[28px]">
          Preferences
        </h2>
        <p className="font-sora text-[13px] leading-[1.4] text-black/70 md:text-[16px]">
          Manage how we contact you about orders and offers.
        </p>
      </div>
      {ROWS.map((row) => (
        <Row key={row.key} title={row.title} description={row.description}>
          <Switch
            checked={values[row.key]}
            disabled={saving}
            label={row.title}
            onChange={(next) => save({ [row.key]: next })}
          />
        </Row>
      ))}
    </section>
  );
}
