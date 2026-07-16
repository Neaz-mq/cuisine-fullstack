import { z } from "zod";
import { cuidSchema, nonEmptyString, priceSchema } from "@/lib/validations/common";

/**
 * src/lib/validations/menu-item.ts
 *
 * Mirrors the MenuItem model (prisma/schema.prisma): title, description,
 * price, categoryId required; imageUrl optional; isAvailable defaults true.
 */
export const createMenuItemSchema = z.object({
  title: nonEmptyString("Title"),
  description: nonEmptyString("Description"),
  price: priceSchema,
  imageUrl: z.url("Image URL must be a valid URL").optional().or(z.literal("")),
  categoryId: cuidSchema,
  isAvailable: z.boolean().default(true),
});

/** All fields optional for PATCH — but at least one field must be present,
 * otherwise a PATCH with an empty body would silently "succeed" while
 * updating nothing, which is confusing for the admin UI to debug. */
export const updateMenuItemSchema = createMenuItemSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });