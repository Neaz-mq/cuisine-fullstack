"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { FIELD, LABEL, OUTLINE_BUTTON, PRIMARY_BUTTON, SelectField } from "@/components/admin/modal-ui";
import { RIDER_VEHICLE_TYPES } from "@/lib/validations/delivery";

export type RiderVehicle = { vehicleType: string; vehicleModel: string; vehiclePlate: string };

const TYPE_OPTIONS = [
  { value: "", label: "Not set" },
  ...RIDER_VEHICLE_TYPES.map((type) => ({ value: type, label: type })),
];

/**
 * Profile → Vehicle (rider panel, Figma "Vehicle & Profile"): what the
 * rider rides and its number plate, so the restaurant knows who to look
 * for at the pick-up counter. Saved to the rider's own staff record.
 */
export default function RiderVehicleForm({ initial }: { initial: RiderVehicle }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    values.vehicleType !== saved.vehicleType ||
    values.vehicleModel.trim() !== saved.vehicleModel ||
    values.vehiclePlate.trim().toUpperCase() !== saved.vehiclePlate;

  const set = (key: keyof RiderVehicle) => (value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/rider/vehicle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save your vehicle. Please try again.");
        return;
      }
      const next = {
        vehicleType: data.vehicleType ?? "",
        vehicleModel: data.vehicleModel ?? "",
        vehiclePlate: data.vehiclePlate ?? "",
      };
      setSaved(next);
      setValues(next);
      toast.success("Vehicle saved");
      router.refresh();
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3]">
          <Bike className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-frank-ruhl text-[22px] font-semibold leading-none text-black md:text-[24px]">Vehicle</h2>
          <p className="mt-1.5 font-sora text-[12px] text-black/60">What you deliver on — shown to the restaurant.</p>
        </div>
      </div>

      <div className="grid gap-4 min-[640px]:grid-cols-3">
        <SelectField
          id="vehicle-type"
          label="Vehicle type"
          value={values.vehicleType}
          onChange={set("vehicleType")}
          options={TYPE_OPTIONS}
        />
        <div>
          <label htmlFor="vehicle-model" className={LABEL}>
            Model
          </label>
          <input
            id="vehicle-model"
            value={values.vehicleModel}
            onChange={(event) => set("vehicleModel")(event.target.value)}
            maxLength={80}
            placeholder="e.g. Honda CB Hornet 160R"
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="vehicle-plate" className={LABEL}>
            Number plate
          </label>
          <input
            id="vehicle-plate"
            value={values.vehiclePlate}
            onChange={(event) => set("vehiclePlate")(event.target.value)}
            maxLength={30}
            placeholder="e.g. DHAKA METRO-LA 12-3456"
            className={`${FIELD} uppercase placeholder:normal-case`}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-[12px] bg-[#FAE7EC] px-4 py-3 font-sora text-[12px] text-[#D72A37]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving || !dirty} className={`${PRIMARY_BUTTON} disabled:cursor-not-allowed`}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? "Saving…" : "Save Vehicle"}
        </button>
        <button
          type="button"
          onClick={() => setValues(saved)}
          disabled={saving || !dirty}
          className={`${OUTLINE_BUTTON} disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-black`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
