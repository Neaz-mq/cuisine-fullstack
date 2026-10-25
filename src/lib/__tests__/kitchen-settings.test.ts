import { describe, it, expect } from "vitest";
import {
  formatKitchenHour,
  isValidTimezone,
  kitchenHoursError,
  kitchenSettingsRows,
  timezoneOptions,
} from "@/lib/kitchen-settings";
import { kitchenSettingsSchema } from "@/lib/validations/kitchen-settings";

const VALID = {
  timezone: "Asia/Dhaka",
  kitchenOpenHour: 10,
  kitchenCloseHour: 20,
  lowStockAlerts: true,
  emergencyStockAlerts: false,
};

describe("formatKitchenHour", () => {
  it("matches Figma's 12-hour labels", () => {
    expect(formatKitchenHour(0)).toBe("12:00 AM");
    expect(formatKitchenHour(10)).toBe("10:00 AM");
    expect(formatKitchenHour(12)).toBe("12:00 PM");
    expect(formatKitchenHour(20)).toBe("8:00 PM");
    expect(formatKitchenHour(23)).toBe("11:00 PM");
  });
});

describe("timezoneOptions", () => {
  it("keeps a saved zone that is outside the list, so Save can't overwrite it", () => {
    const options = timezoneOptions("Asia/Kathmandu");
    expect(options[0]).toEqual({ value: "Asia/Kathmandu", label: "Asia/Kathmandu" });
    expect(options.some((o) => o.value === "Asia/Dhaka")).toBe(true);
  });

  it("doesn't duplicate a zone that is already listed", () => {
    const options = timezoneOptions("Asia/Dhaka");
    expect(options.filter((o) => o.value === "Asia/Dhaka")).toHaveLength(1);
  });
});

describe("isValidTimezone", () => {
  it("accepts real IANA zones and rejects nonsense", () => {
    expect(isValidTimezone("Asia/Dhaka")).toBe(true);
    expect(isValidTimezone("Europe/Malta")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });
});

describe("kitchenHoursError", () => {
  it("rejects the same open and close time only", () => {
    expect(kitchenHoursError(10, 10)).not.toBeNull();
    expect(kitchenHoursError(10, 20)).toBeNull();
    // an overnight kitchen (22:00 → 02:00) is legitimate
    expect(kitchenHoursError(22, 2)).toBeNull();
  });
});

describe("kitchenSettingsSchema", () => {
  it("accepts the five settings", () => {
    expect(kitchenSettingsSchema.safeParse(VALID).success).toBe(true);
  });

  it("strips anything that isn't one of the five (money settings stay out of reach)", () => {
    const result = kitchenSettingsSchema.safeParse({ ...VALID, taxRateDineIn: 99, currency: "JPY" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data).sort()).toEqual(Object.keys(VALID).sort());
    }
  });

  it("rejects an unknown time zone", () => {
    expect(kitchenSettingsSchema.safeParse({ ...VALID, timezone: "Nowhere/Land" }).success).toBe(false);
  });

  it("rejects hours outside 0–23 and non-integers", () => {
    expect(kitchenSettingsSchema.safeParse({ ...VALID, kitchenOpenHour: 24 }).success).toBe(false);
    expect(kitchenSettingsSchema.safeParse({ ...VALID, kitchenCloseHour: -1 }).success).toBe(false);
    expect(kitchenSettingsSchema.safeParse({ ...VALID, kitchenOpenHour: 9.5 }).success).toBe(false);
  });

  it("rejects equal open and close hours", () => {
    const result = kitchenSettingsSchema.safeParse({ ...VALID, kitchenOpenHour: 8, kitchenCloseHour: 8 });
    expect(result.success).toBe(false);
  });

  it("requires both alert switches — a missing one must not silently mean 'on'", () => {
    const { lowStockAlerts: _low, ...withoutLow } = VALID;
    void _low;
    expect(kitchenSettingsSchema.safeParse(withoutLow).success).toBe(false);
    const { emergencyStockAlerts: _emergency, ...withoutEmergency } = VALID;
    void _emergency;
    expect(kitchenSettingsSchema.safeParse(withoutEmergency).success).toBe(false);
  });
});

describe("kitchenSettingsRows", () => {
  it("words the export exactly like the page", () => {
    expect(kitchenSettingsRows(VALID)).toEqual([
      ["Restaurant Time zone", "Asia/Dhaka"],
      ["Kitchen Opens", "10:00 AM"],
      ["Kitchen Closes", "8:00 PM"],
      ["Low Stock Alerts", "On"],
      ["Emergency Stock Alerts", "Off"],
    ]);
  });
});
