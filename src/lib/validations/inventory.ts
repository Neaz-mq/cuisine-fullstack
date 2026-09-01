import { z } from "zod";
import { cuidSchema, nonEmptyString } from "@/lib/validations/common";

/**
 * src/lib/validations/inventory.ts
 *
 * Schemas for Inventory Management: InventoryItem, a menu item's recipe
 * (MenuItemIngredient), manual StockMovement entries, Supplier, and
 * PurchaseOrder/PurchaseOrderItem. Mirrors the create/update-partial
 * convention used across every other validations/*.ts file — see
 * menu-item.ts for the pattern this follows.
 */

const inventoryUnitSchema = z.enum(["GRAM", "KILOGRAM", "MILLILITER", "LITER", "PIECE"]);

/** Stock quantities/costs are decimal (0.5kg, 12.75 currency units),
 * unlike the existing quantitySchema in common.ts (positive INT, built
 * for cart item counts) — separate schemas rather than reusing that one. */
const positiveFloatSchema = (label: string) =>
  z.number().finite().positive(`${label} must be greater than 0`);

const nonNegativeFloatSchema = (label: string) =>
  z.number().finite().nonnegative(`${label} cannot be negative`);

// ─── Inventory items ────────────────────────────────────────────────────

export const createInventoryItemSchema = z.object({
  name: nonEmptyString("Name"),
  unit: inventoryUnitSchema,
  // Starting stock — e.g. entering an existing pantry count when first
  // setting the item up. Defaults to 0 (a brand-new item with nothing on
  // hand yet, to be stocked later via a PurchaseOrder).
  currentStock: nonNegativeFloatSchema("Starting stock").default(0),
  reorderThreshold: nonNegativeFloatSchema("Reorder threshold").default(0),
  costPerUnit: nonNegativeFloatSchema("Cost per unit").default(0),
  // ── Figma-র "Add Ingredient" modal-এর বাকি ঘরগুলো ────────────────
  // সবগুলোই ঐচ্ছিক: একটা উপকরণ কেবল নাম আর একক দিয়েও তৈরি করা যায়,
  // বাকিটা পরে ভরা যায়। schema.prisma-য় এদের ব্যাখ্যা।
  category: z.string().trim().max(60).optional().or(z.literal("")),
  maxCapacity: nonNegativeFloatSchema("Max capacity").default(0),
  emergencyThreshold: nonNegativeFloatSchema("Emergency threshold").default(0),
  supplierId: cuidSchema.optional().or(z.literal("")),
  image: z.url("Image must be a valid URL").optional().or(z.literal("")),
});

export const updateInventoryItemSchema = z
  .object({
    name: nonEmptyString("Name"),
    unit: inventoryUnitSchema,
    reorderThreshold: nonNegativeFloatSchema("Reorder threshold"),
    costPerUnit: nonNegativeFloatSchema("Cost per unit"),
    category: z.string().trim().max(60).nullable(),
    maxCapacity: nonNegativeFloatSchema("Max capacity"),
    emergencyThreshold: nonNegativeFloatSchema("Emergency threshold"),
    // ⚠️ nullable — ডিফল্ট সরবরাহকারী সরিয়ে দেওয়াটাও একটা বৈধ আপডেট।
    supplierId: cuidSchema.nullable(),
    image: z.url("Image must be a valid URL").nullable().or(z.literal("")),
    isActive: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });
// currentStock is deliberately NOT editable here — every change to it
// must go through a StockMovement (the manual-adjustment endpoint below,
// or a PurchaseOrder receipt), never a bare PATCH, so the ledger can
// never drift out of sync with the balance it's supposed to explain.

// ─── Recipes (MenuItemIngredient) ──────────────────────────────────────

const recipeLineSchema = z.object({
  inventoryItemId: cuidSchema,
  quantityRequired: positiveFloatSchema("Quantity required"),
});

/** PUT body for /api/admin/menu-items/[id]/ingredients — replaces the
 * menu item's ENTIRE recipe with this list (the admin UI always submits
 * the full, current set of ingredient rows for that item, not
 * incremental add/remove calls — simplest correct semantics). An empty
 * array is valid: it means "this item has no recipe / isn't
 * stock-tracked," matching MenuItem.ingredients' empty-by-default state. */
export const setMenuItemRecipeSchema = z.object({
  ingredients: z
    .array(recipeLineSchema)
    .refine((lines) => new Set(lines.map((l) => l.inventoryItemId)).size === lines.length, {
      message: "Each ingredient can only appear once in a recipe",
    }),
});

// ─── Manual stock movements ─────────────────────────────────────────────

const manualStockMovementTypeSchema = z.enum(["WASTAGE", "ADJUSTMENT", "RETURN"]);
// PURCHASE is deliberately excluded — it's only ever produced by
// receiving a PurchaseOrder (see receive-purchase-order.ts), so every
// stock increase from a purchase always has a Supplier/cost trail behind
// it. ORDER_DEDUCTION is excluded because it's system-generated only
// (advanceOrderToPreparing.ts) — neither belongs in a manual-entry form.

/** POST body for /api/admin/inventory/[id]/movements. `quantity` is
 * always entered as a positive number by staff ("3 units spoiled") — the
 * route derives the correct sign (WASTAGE always decreases, RETURN
 * always increases; ADJUSTMENT can go either way via `direction`) rather
 * than asking staff to type a negative number, which is an easy mistake
 * to make or misread on review. */
export const recordStockMovementSchema = z.object({
  type: manualStockMovementTypeSchema,
  quantity: positiveFloatSchema("Quantity"),
  // Only meaningful for ADJUSTMENT — ignored for WASTAGE/RETURN, whose
  // direction is fixed by their type.
  direction: z.enum(["INCREASE", "DECREASE"]).default("DECREASE"),
  note: nonEmptyString("A note explaining this change"),
});

/**
 * POST /api/admin/inventory/[id]/restock — Figma-র "Items Restock" modal।
 *
 * ⚠️ এটা recordStockMovementSchema-র সাথে মেলানো হয়নি, ইচ্ছাকৃতভাবে।
 * ওটা WASTAGE/ADJUSTMENT/RETURN-এর জন্য, যেখানে একটা `note`
 * **বাধ্যতামূলক** — কারণ ওগুলো ব্যাখ্যা দাবি করে ("কেন ৩ কেজি কমে
 * গেল?")। মাল আসা তার উল্টো: সেটাই স্বাভাবিক ঘটনা, আর প্রতিবার
 * একটা কারণ লিখতে বললে লোকে "restock" লিখে চালিয়ে দিত।
 */
export const restockInventoryItemSchema = z.object({
  quantityReceived: positiveFloatSchema("Quantity received"),
  // দিলে InventoryItem.costPerUnit-ও হালনাগাদ হয় (সবচেয়ে সাম্প্রতিক
  // দামই জেতে — PurchaseOrder receive করার একই নিয়ম)। না দিলে পুরনো
  // দামই থাকে; ভুল করে 0 বসিয়ে food cost শূন্য করে দেওয়ার চেয়ে ভালো।
  costPerUnit: nonNegativeFloatSchema("Cost per unit").optional(),
  // মাল কার কাছ থেকে এলো — দিলে উপকরণের ডিফল্ট সরবরাহকারীও এতে বদলায়।
  supplierId: cuidSchema.optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

// ─── Suppliers ──────────────────────────────────────────────────────────

export const createSupplierSchema = z.object({
  name: nonEmptyString("Name"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z
    .email("Enter a valid email address")
    .trim()
    .toLowerCase()
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  // Figma-র "Supply Category" — UI একটা নির্দিষ্ট তালিকা থেকে বাছতে
  // দেয় (lib/supplier-status.ts), কিন্তু schema-য় এটা free-text, তাই
  // এখানেও enum নয়। কারণ schema.prisma-র মন্তব্যে।
  category: z.string().trim().max(60).optional().or(z.literal("")),
  /**
   * Figma-র "Product Supplied" chips।
   *
   * ⚠️ `.max(30)` — কোনো ব্যবসায়িক সীমা নয়, একটা রক্ষাকবচ। ঘরটা
   * free-text, তাই একটা স্ক্রিপ্ট হাজারটা নাম পাঠিয়ে সারিটাকে
   * অসীম বড় করে দিতে পারত।
   */
  products: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  // create-এও status পাঠানো যায়, কারণ Figma-র modal-এ ঘরটা আছে।
  // না পাঠালে schema-র default (true)।
  isActive: z.boolean().optional(),
});

export const updateSupplierSchema = createSupplierSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

// ─── Purchase orders ────────────────────────────────────────────────────

const purchaseOrderLineSchema = z.object({
  inventoryItemId: cuidSchema,
  quantityOrdered: positiveFloatSchema("Quantity ordered"),
  costPerUnit: nonNegativeFloatSchema("Cost per unit"),
});

const uniqueIngredientLines = <T extends { inventoryItemId: string }>(lines: T[]) =>
  new Set(lines.map((l) => l.inventoryItemId)).size === lines.length;

export const createPurchaseOrderSchema = z.object({
  supplierId: cuidSchema,
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  items: z
    .array(purchaseOrderLineSchema)
    .min(1, "Add at least one item to the purchase order")
    .refine(uniqueIngredientLines, {
      message: "Each ingredient can only appear once per purchase order",
    }),
});

/** PATCH — only meaningful while status = DRAFT (enforced in the route,
 * not here): edits the supplier/note/full item list, or flips
 * DRAFT -> ORDERED via markOrdered. Receiving (-> RECEIVED) is its own
 * dedicated endpoint (POST .../receive) since it needs actual-received
 * quantities per line, not just a status flip. */
export const updatePurchaseOrderSchema = z
  .object({
    supplierId: cuidSchema,
    note: z.string().trim().max(1000),
    items: z
      .array(purchaseOrderLineSchema)
      .min(1, "Add at least one item to the purchase order")
      .refine(uniqueIngredientLines, {
        message: "Each ingredient can only appear once per purchase order",
      }),
    markOrdered: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

/** POST body for /api/admin/purchase-orders/[id]/receive — actual
 * quantities received per line. The admin UI should default each line to
 * its ordered quantity (the common case: everything arrived as ordered)
 * but leave it editable for a short delivery. Which inventoryItemIds are
 * valid here depends on the specific PO's own line items, which this
 * schema has no way to know — that cross-check happens in
 * receive-purchase-order.ts itself. */
export const receivePurchaseOrderSchema = z.object({
  items: z
    .array(
      z.object({
        inventoryItemId: cuidSchema,
        quantityReceived: nonNegativeFloatSchema("Quantity received"),
      })
    )
    .min(1, "Nothing to receive"),
});