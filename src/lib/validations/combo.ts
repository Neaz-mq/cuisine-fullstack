import { z } from "zod";
import { cuidSchema, quantitySchema } from "@/lib/validations/common";

/**
 * src/lib/validations/combo.ts
 *
 * Admin create / update schemas for the home page "Combo Deals".
 * A combo is a name, a description, an optional image and 1–10 menu items
 * with a quantity each. It has no price field on purpose — see lib/combo-pricing.ts.
 */
export const MAX_COMBO_ITEMS = 10;

const itemsSchema = z
  .array(z.object({ menuItemId: cuidSchema, quantity: quantitySchema }))
  .min(1, "Add at least one menu item to the combo")
  .max(MAX_COMBO_ITEMS, `A combo can have at most ${MAX_COMBO_ITEMS} items`)
  .refine(
    (items) => new Set(items.map((i) => i.menuItemId)).size === items.length,
    "Each menu item can appear only once — raise its quantity instead"
  );

const fields = {
  name: z.string().trim().min(1, "Combo name is required").max(80, "Keep the name under 80 characters"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(300, "Keep the description under 300 characters"),
  /** Supabase Storage public URL from /api/admin/upload-image. null = use the first item's image. */
  imageUrl: z.string().url("That doesn't look like a valid image URL").nullable().optional(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0, "Order must be 0 or more").max(9999, "Order is too large"),
  items: itemsSchema,
};

// isActive / sortOrder fall back to true / 999 in the route.
export const createComboSchema = z.object({
  ...fields,
  isActive: fields.isActive.optional(),
  sortOrder: fields.sortOrder.optional(),
});

// Partial: the edit form sends everything, the Show/Hide switch sends only isActive.
export const updateComboSchema = z.object(fields).partial();