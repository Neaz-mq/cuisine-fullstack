import { z } from "zod";
import { isValidTimezone, kitchenHoursError } from "@/lib/kitchen-settings";

/**
 * src/lib/validations/kitchen-settings.ts
 *
 * Body of PATCH /api/admin/kitchen/settings — the kitchen panel's Settings
 * page. Exactly the five fields on that page and nothing else: the schema
 * strips unknown keys, so a request that also carries `taxRateDineIn` or
 * `currency` still can't reach the money settings.
 *
 * The booleans have no `.default(...)` on purpose. The owner's schema
 * defaults them to true so an old client can't switch alerts off by
 * accident; here a missing value should be an error, not a silent "on" that
 * overwrites a deliberate "off".
 */
export const kitchenSettingsSchema = z
  .object({
    timezone: z
      .string()
      .trim()
      .min(1, "Choose a time zone")
      .refine(isValidTimezone, "That isn't a valid time zone"),
    kitchenOpenHour: z.number().int().min(0).max(23),
    kitchenCloseHour: z.number().int().min(0).max(23),
    lowStockAlerts: z.boolean(),
    emergencyStockAlerts: z.boolean(),
  })
  .refine((data) => kitchenHoursError(data.kitchenOpenHour, data.kitchenCloseHour) === null, {
    message: "Kitchen open and close time can't be the same",
    path: ["kitchenCloseHour"],
  });

export type KitchenSettingsInput = z.infer<typeof kitchenSettingsSchema>;
