"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "react-toastify";
import {
  FIELD,
  ImageDropzone,
  LABEL,
  ModalError,
  ModalShell,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  SelectField,
  TEXTAREA,
} from "@/components/admin/modal-ui";
import { UNIT_LABELS } from "@/lib/inventory-status";
import { calculateFoodCost, getFoodCostHealth } from "@/lib/menu-profitability";
import { calcDishStock } from "@/lib/stock-availability";
import {
  compatibleUnits,
  convertQuantity,
  isRecipeUnit,
  toDisplayQuantity,
  type RecipeUnit,
} from "@/lib/recipe-units";

/**
 * src/app/admin/menu/MenuItemFormModal.tsx
 *
 * Figma Frame 2147236195 — একটা পদ যোগ বা সম্পাদনার form,
 * `/admin/menu/new` আর `/admin/menu/<id>/edit` পাতা দুটোর বদলে।
 *
 *   ছবি (2147232424)   drop-zone, h 189, radius 20, BG #F9F6F3
 *   Food Name          পূর্ণ প্রস্থ
 *   Description        পূর্ণ প্রস্থ, h 86 (দুই সারির ঘর)
 *   Category           পূর্ণ প্রস্থ   ← Figma-তে নেই, নিচে ব্যাখ্যা
 *   Regular Price │ Status
 *   Nutrition          label + চারটে ছোট ঘর (Kcal · Fat · Protin · Carb)
 *   Ingredients        chip সারি + ("Type.." + "Add +")
 *   Food Status │ Prep Time      ← Figma-তে "Mead Time", নিচে ব্যাখ্যা
 *   Cancel │ Save Change
 *
 * ⚠️ খোলস, ঘর, label, dropdown, drop-zone আর বোতাম — একটাও এই ফাইলে
 * হাতে লেখা হয়নি, সবই `components/admin/modal-ui.tsx` থেকে। spec-এর
 * মাপগুলো (কার্ড 735/padding 30/gap 40/radius 30, ঘর h 43 radius 12
 * BG #F9F6F3, label Frank Ruhl 500 14px LH 160%, drop-zone h 189
 * radius 20, বোতাম h 46) ওই ফাইলে লেখা Frame 2147236222-এর হুবহু
 * একই সংখ্যা — designer একই modal-ই আবার ব্যবহার করেছেন।
 *
 * ── Category ঘরটা Figma-তে নেই, কিন্তু বাদ দেওয়া যায় না ──────────────
 *
 * ⚠️ `MenuItem.categoryId` **required** — শ্রেণি ছাড়া কোনো পদ তৈরিই
 * হয় না। mockup-টা সম্ভবত একটা শ্রেণির ভেতর থেকে "Add" চাপার দৃশ্য,
 * যেখানে শ্রেণিটা আগে থেকেই জানা; কিন্তু এই অ্যাপে "+ Add Item"
 * toolbar-এ, অর্থাৎ সব শ্রেণির উপরে। ঘরটা না রাখলে হয় প্রতিটা নতুন
 * পদ নীরবে প্রথম শ্রেণিতে গিয়ে পড়ত, নয় একটা পদের শ্রেণি বদলানোর
 * কোনো উপায়ই থাকত না।
 *
 * তাই Figma-র সারিগুলো অবিকৃত রেখে Description-এর পরে **একটা নতুন
 * পূর্ণ-প্রস্থ সারি** যোগ করা হয়েছে — Name/Description-এর মতোই দেখতে,
 * তাই চোখে বাড়তি লাগে না।
 *
 * ── RECIPE এখন এখানেই ───────────────────────────────────────────────
 *
 * "Ingredients" ঘরটা এখন **recipe** (restaurant system-এর স্বাভাবিক
 * নিয়ম): প্রতিটা সারি = একটা InventoryItem + এক serving-এ কতটা লাগে।
 * Save-এ পদ আর recipe একই transaction-এ যায়, আর order PREPARING হলে
 * এই recipe দিয়েই stock কাটে (lib/advance-order-to-preparing.ts)।
 *
 * পরিমাণ g/ml/Kg/L যেকোনো সঙ্গত এককে লেখা যায়; save-এর আগে item-এর
 * নিজের এককে রূপান্তর হয় (lib/recipe-units.ts) — stock সবসময় ওই
 * এককেই কাটে।
 *
 * নিচের "Other ingredients" chip-গুলো আগের `ingredientTags` — stock-এ
 * ধরা হয় না এমন জিনিস (লবণ, পানি) গ্রাহককে দেখানোর জন্য। recipe-র
 * নামগুলো save-এর সময় আপনা থেকে tag-তালিকায় যোগ হয়, তাই কাউকে
 * একই নাম দুবার লিখতে হয় না।
 */

export type MenuItemDraft = {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string | null;
  categoryId: string;
  isAvailable: boolean;
  calories: number | null;
  fatGrams: number | null;
  proteinGrams: number | null;
  carbGrams: number | null;
  ingredientTags: string[];
  foodStatus: string | null;
  prepTimeMinutes: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /**
   * না দিলে "Add New Item" (POST), দিলে সেই পদের সম্পাদনা (PATCH)।
   * Category modal-এর সাথে একই ছাঁদ।
   */
  item?: MenuItemDraft;
  /** সব শ্রেণি — Category dropdown-এর জন্য। */
  categories: readonly { value: string; label: string }[];
  /** দামের ঘরের গায়ে দেখানোর জন্য, যেমন "USD"। */
  currency?: string;
};

/** Figma-র Nutrition সারির ছোট label — Frank Ruhl 500 **12px**, ১৪ নয়। */
const SUB_LABEL = "mb-1.5 block font-frank-ruhl text-[12px] font-medium leading-[1.6] text-black";

type InventoryOption = {
  id: string;
  name: string;
  unit: RecipeUnit;
  /** Only sent to staff who may see inventory costs (owner/manager). */
  costPerUnit?: number;
  currentStock?: number;
};

type RecipeRow = {
  key: string;
  inventoryItemId: string;
  /** string, number নয় — অর্ধেক লেখা "0." ধরে রাখতে। */
  quantity: string;
  /** যে এককে লেখা হচ্ছে; save-এ item-এর নিজের এককে রূপান্তর হয়। */
  unit: RecipeUnit;
};

function newRow(): RecipeRow {
  return { key: crypto.randomUUID(), inventoryItemId: "", quantity: "", unit: "GRAM" };
}

/**
 * সংখ্যার ঘর → সংখ্যা, খালি হলে null, আর অবৈধ লেখা হলে NaN।
 *
 * ⚠️ তিনটে আলাদা ফল, আর তিনটেই দরকার: null মানে "জানা নেই" (বৈধ),
 * NaN মানে "যা লেখা আছে সেটা সংখ্যা নয়" (ভুল)। দুটোকে এক করে ফেললে
 * ভুল লেখা চুপচাপ "জানা নেই" হয়ে সংরক্ষিত হত।
 */
function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return Number(trimmed);
}

/** null বা সংখ্যা → ঘরে বসানোর মতো string। */
function toFieldValue(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

export default function MenuItemFormModal(props: Props) {
  // বন্ধ থাকলে কিছুই mount হয় না — তাই প্রতিবার খোলা মানে নতুন mount,
  // আর `useState`-এর প্রাথমিক মানই একমাত্র সত্য। হাতে লেখা কোনো
  // "reset" তালিকা রক্ষণাবেক্ষণ করতে হয় না; Supplier/Staff/Category-র
  // modal-গুলোও ঠিক এভাবেই দুই ভাগে লেখা।
  if (!props.open) return null;
  return <MenuItemFormModalContent {...props} />;
}

function MenuItemFormModalContent({ open, onClose, item, categories, currency }: Props) {
  const router = useRouter();
  const isEdit = Boolean(item);

  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  // string, number নয় — অর্ধেক লেখা "12." বা খালি ঘরকে number দিয়ে
  // ধরা যায় না, আর `NaN` বসালে ঘরটা নীরবে ফাঁকা হয়ে যেত।
  const [price, setPrice] = useState(item ? String(item.price) : "");
  // নতুন পদে প্রথম শ্রেণিটা আগে থেকেই বাছা — SelectField-এ কোনো
  // "কিছু বাছা হয়নি" অবস্থা নেই (অজানা মান এলে সে প্রথমটাই দেখায়),
  // তাই খালি রাখলে পর্দায় একটা শ্রেণি দেখা যেত অথচ state ফাঁকা
  // থাকত আর save-এ "Please choose a category" আসত।
  const [categoryId, setCategoryId] = useState(
    item?.categoryId ?? categories[0]?.value ?? ""
  );
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true);
  const [imageUrl, setImageUrl] = useState<string | null>(item?.imageUrl ?? null);

  const [calories, setCalories] = useState(toFieldValue(item?.calories));
  const [fat, setFat] = useState(toFieldValue(item?.fatGrams));
  const [protein, setProtein] = useState(toFieldValue(item?.proteinGrams));
  const [carbs, setCarbs] = useState(toFieldValue(item?.carbGrams));

  const [tags, setTags] = useState<string[]>(item?.ingredientTags ?? []);
  const [tagDraft, setTagDraft] = useState("");

  // Recipe (inventory-linked ingredients). `recipeStatus` gates Save: saving
  // while the recipe is still loading (or failed to load) would either lose
  // it or — worse — send an empty one and wipe the saved recipe.
  const [options, setOptions] = useState<InventoryOption[]>([]);
  const [rows, setRows] = useState<RecipeRow[]>([]);
  const [recipeStatus, setRecipeStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);

  const [foodStatus, setFoodStatus] = useState(item?.foodStatus ?? "");
  const [prepTime, setPrepTime] = useState(toFieldValue(item?.prepTimeMinutes));

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // `recipeStatus` already starts as "loading", and the "Try again" button
    // sets it back to "loading" itself — so nothing is set synchronously here.
    (async () => {
      try {
        const [optionsRes, recipeRes] = await Promise.all([
          fetch("/api/admin/menu-items/recipe-options"),
          isEdit ? fetch(`/api/admin/menu-items/${item!.id}/ingredients`) : Promise.resolve(null),
        ]);
        if (!optionsRes.ok || (recipeRes && !recipeRes.ok)) throw new Error("load failed");

        const loadedOptions = (
          (await optionsRes.json()) as {
            id: string;
            name: string;
            unit: string;
            costPerUnit?: number;
            currentStock?: number;
          }[]
        )
          .filter((o) => isRecipeUnit(o.unit))
          .map((o) => ({
            id: o.id,
            name: o.name,
            unit: o.unit as RecipeUnit,
            costPerUnit: o.costPerUnit,
            currentStock: o.currentStock,
          }));

        const saved = recipeRes
          ? ((await recipeRes.json()) as {
              quantityRequired: number;
              inventoryItem: { id: string; name: string; unit: string };
            }[])
          : [];

        if (cancelled) return;

        // An ingredient made Inactive after the recipe was saved isn't in the
        // picker list, but must still show (and keep saving) — never drop it silently.
        const known = new Map<string, InventoryOption>(loadedOptions.map((o) => [o.id, o]));
        for (const line of saved) {
          if (!known.has(line.inventoryItem.id) && isRecipeUnit(line.inventoryItem.unit)) {
            known.set(line.inventoryItem.id, {
              id: line.inventoryItem.id,
              name: `${line.inventoryItem.name} (inactive)`,
              unit: line.inventoryItem.unit,
            });
          }
        }

        const loadedRows: RecipeRow[] = saved
          .filter((line) => known.has(line.inventoryItem.id))
          .map((line) => {
            const stockUnit = known.get(line.inventoryItem.id)!.unit;
            const display = toDisplayQuantity(line.quantityRequired, stockUnit);
            return {
              key: crypto.randomUUID(),
              inventoryItemId: line.inventoryItem.id,
              quantity: String(display.value),
              unit: display.unit,
            };
          });

        // Names now covered by the recipe leave the free-text chips (they're
        // re-added from the recipe on save) — no duplicates in the form.
        const recipeNames = new Set(
          loadedRows.map((r) => known.get(r.inventoryItemId)!.name.replace(/ \(inactive\)$/, "").toLowerCase())
        );

        setOptions([...known.values()].sort((a, b) => a.name.localeCompare(b.name)));
        setRows(loadedRows);
        setTags((prev) => prev.filter((tag) => !recipeNames.has(tag.toLowerCase())));
        setRecipeStatus("ready");
      } catch {
        if (!cancelled) setRecipeStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
    // `item` is stable for the life of this mount (the modal remounts per open).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  function updateRow(key: string, patch: Partial<RecipeRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function pickIngredient(key: string, inventoryItemId: string) {
    const stockUnit = options.find((o) => o.id === inventoryItemId)?.unit;
    // New ingredient → its own unit by default; the cook can switch to a smaller one.
    updateRow(key, { inventoryItemId, ...(stockUnit ? { unit: stockUnit } : {}) });
  }

  function addTag() {
    const value = tagDraft.trim();
    if (!value) return;
    // ⚠️ একই নাম দুবার নয় — case-insensitive মিল, কারণ "Cheese" আর
    // "cheese" ব্যবহারকারীর কাছে এক জিনিস। মিলে গেলে চুপচাপ উপেক্ষা,
    // কোনো ভুল-বার্তা নয়: এটা ভুল নয়, ইতিমধ্যেই হয়ে যাওয়া কাজ।
    // SupplierFormModal-এর "Product Supplied" ঘরে হুবহু একই নিয়ম।
    if (!tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      setTags((prev) => [...prev, value]);
    }
    setTagDraft("");
  }

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const parsedPrice = Number(price);

    if (!trimmedTitle) return setError("Please enter a food name.");
    if (!trimmedDescription) return setError("Please enter a description.");
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return setError("Please enter a valid regular price.");
    }
    if (!categoryId) return setError("Please choose a category.");

    const numeric = {
      calories: toNumberOrNull(calories),
      fatGrams: toNumberOrNull(fat),
      proteinGrams: toNumberOrNull(protein),
      carbGrams: toNumberOrNull(carbs),
      prepTimeMinutes: toNumberOrNull(prepTime),
    };

    const values = Object.values(numeric);
    if (values.some((value) => value !== null && !Number.isFinite(value))) {
      return setError("Nutrition and time values must be numbers.");
    }
    if (values.some((value) => value !== null && value < 0)) {
      return setError("Nutrition and time values can't be negative.");
    }

    // ── Recipe: validate, then convert each line into its item's own unit ──
    const recipe: { inventoryItemId: string; quantityRequired: number }[] = [];
    const recipeNames: string[] = [];
    for (const row of rows) {
      const blank = !row.inventoryItemId && row.quantity.trim() === "";
      if (blank) continue; // an untouched "Add ingredient" row is just ignored

      const option = options.find((o) => o.id === row.inventoryItemId);
      if (!option) return setError("Choose an inventory item for every ingredient row.");

      const typed = Number(row.quantity);
      if (!Number.isFinite(typed) || typed <= 0) {
        return setError(`Enter how much ${option.name} one serving uses (more than 0).`);
      }
      const quantityRequired = convertQuantity(typed, row.unit, option.unit);
      if (!Number.isFinite(quantityRequired) || quantityRequired <= 0) {
        return setError(`"${option.name}" quantity is too small or in an incompatible unit.`);
      }
      if (recipe.some((line) => line.inventoryItemId === option.id)) {
        return setError(`${option.name} is listed twice — combine it into one row.`);
      }
      recipe.push({ inventoryItemId: option.id, quantityRequired });
      recipeNames.push(option.name.replace(/ \(inactive\)$/, ""));
    }

    // Customer-facing list = recipe names + the free-text extras (no duplicates).
    const allTags = [...recipeNames];
    for (const tag of tags) {
      if (!allTags.some((name) => name.toLowerCase() === tag.toLowerCase())) allTags.push(tag);
    }
    if (allTags.length > 20) {
      return setError("A dish can show at most 20 ingredients. Remove a few.");
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        isEdit ? `/api/admin/menu-items/${item!.id}` : "/api/admin/menu-items",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmedTitle,
            description: trimmedDescription,
            price: parsedPrice,
            /**
             * ⚠️ ছবি সরালে `null` নয়, খালি string। schema-য় `imageUrl`
             * হলো `z.url().optional().or(z.literal(""))` — অর্থাৎ null
             * ওখানে **বৈধ নয়**, 400 ফিরত। পুরনো MenuItemForm-এ
             * `|| null` লেখা আছে, তাই ওই পাতা থেকে ছবি মোছার চেষ্টা
             * করলে আজও নীরবে ব্যর্থ হয়।
             *
             * খালি string সব জায়গাতেই falsy, তাই তালিকা আর কার্ডগুলোয়
             * ছবিহীন অবস্থাটা আগের মতোই দেখায়।
             */
            imageUrl: imageUrl ?? "",
            categoryId,
            isAvailable,
            /**
             * ⚠️ সংখ্যার ঘরগুলো `null` হিসেবেই যায়, বাদ পড়ে না।
             * `undefined` হলে JSON.stringify মাঠটাই ফেলে দিত, আর PATCH-এ
             * আগের মানটা থেকে যেত — অর্থাৎ একবার বসানো ক্যালরি আর
             * কখনো মোছা যেত না।
             */
            calories: numeric.calories,
            fatGrams: numeric.fatGrams,
            proteinGrams: numeric.proteinGrams,
            carbGrams: numeric.carbGrams,
            ingredientTags: allTags,
            recipe,
            foodStatus: foodStatus.trim(),
            prepTimeMinutes: numeric.prepTimeMinutes,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }

      onClose();
      router.refresh();
      toast.success(isEdit ? `"${trimmedTitle}" updated.` : `"${trimmedTitle}" added.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Live food cost (owner/manager only: costs come with the options) ────
  const canSeeCosts = options.some((o) => o.costPerUnit !== undefined);

  function lineBase(row: RecipeRow): { option: InventoryOption; qty: number } | null {
    const option = options.find((o) => o.id === row.inventoryItemId);
    const typed = Number(row.quantity);
    if (!option || !Number.isFinite(typed) || typed <= 0) return null;
    const qty = convertQuantity(typed, row.unit, option.unit);
    return Number.isFinite(qty) && qty > 0 ? { option, qty } : null;
  }

  function money(value: number): string {
    return `${currency ? `${currency} ` : ""}${value.toFixed(2)}`;
  }

  const costLines = rows
    .map(lineBase)
    .filter((line): line is { option: InventoryOption; qty: number } => line !== null);

  const sellingPrice = Number(price);
  const foodCost = calculateFoodCost(
    costLines.map((line) => ({
      quantityRequired: line.qty,
      costPerUnit: line.option.costPerUnit ?? 0,
    })),
    Number.isFinite(sellingPrice) ? sellingPrice : 0
  );
  const costHealth = getFoodCostHealth(foodCost.foodCostPercent);

  // "How many can we still make?" — from stock on hand (the customer-side
  // check additionally subtracts food already promised to open orders).
  const stockCover = calcDishStock(
    costLines.map((line) => ({
      inventoryItemId: line.option.id,
      name: line.option.name,
      quantityRequired: line.qty,
    })),
    new Map(options.map((o) => [o.id, o.currentStock ?? 0]))
  );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      titleId="menu-item-form-title"
      title={isEdit ? "Edit Menu Item" : "Add New Item"}
      footer={
        /* Frame 2147236023: row, gap 8, উচ্চতা 46, দুটোই flex-grow 1। */
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={`${OUTLINE_BUTTON} flex-1`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            // ⚠️ upload চলাকালীনও বন্ধ — নাহলে ছবি ওঠার আগেই save হয়ে
            // যেত আর পুরনো URL-টাই সংরক্ষিত থাকত, অথচ পর্দায় নতুন ছবির
            // preview দেখা যেত।
            disabled={submitting || uploading || recipeStatus !== "ready"}
            className={`${PRIMARY_BUTTON} flex-1`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Saving…" : "Save Change"}
          </button>
        </div>
      }
    >
      {error && <ModalError message={error} />}

      {/* Frame 2147232424 — ছবির drop-zone, সবার উপরে। */}
      <ImageDropzone
        value={imageUrl}
        onChange={setImageUrl}
        onError={setError}
        uploading={uploading}
        setUploading={setUploading}
      />

      {/* Frame 2147236092: প্রতিটা সারি gap 16, সারিগুলোর মাঝে 20। */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="menu-item-title" className={LABEL}>
            Food Name
          </label>
          <input
            id="menu-item-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Crispy French Fries"
            className={FIELD}
          />
        </div>

        {/* Frame 2147236088: ঘরটা 86 উঁচু = ঠিক দুটো সাধারণ ঘরের সমান। */}
        <div className="md:col-span-2">
          <label htmlFor="menu-item-description" className={LABEL}>
            Description
          </label>
          <textarea
            id="menu-item-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Golden, crispy, and perfectly salted french fries."
            className={TEXTAREA}
          />
        </div>

        {/* ⚠️ Figma-তে এই সারিটা নেই — উপরের ফাইল-মন্তব্য দ্রষ্টব্য। */}
        <SelectField
          id="menu-item-category"
          label="Category"
          value={categoryId}
          onChange={setCategoryId}
          options={categories}
          className="md:col-span-2"
        />

        {/* Frame 2147236546: Regular Price │ Status, দুটোই 327.5px। */}
        <div>
          <label htmlFor="menu-item-price" className={LABEL}>
            Regular Price{currency ? ` (${currency})` : ""}
          </label>
          <div className="relative">
            {/**
             * ⚠️ ISO code, "$" চিহ্ন নয় — রেস্তোরাঁটা ডলারে দাম নাও রাখতে
             * পারে, আর যে একটামাত্র পর্দায় দাম **বসানো** হয় সেখানেই ভুল
             * চিহ্ন দেখালে ভুল দাম টাইপ হয়। পুরনো form-এও একই কথা লেখা।
             */}
            {currency && (
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-sora text-[11px] text-black/50">
                {currency}
              </span>
            )}
            <input
              id="menu-item-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Type here"
              className={`${FIELD} ${currency ? "pl-12" : ""}`}
            />
          </div>
        </div>

        {/* Figma-তে ঘরটা একটা dropdown (arrow-down সহ) — SelectField। */}
        <SelectField
          id="menu-item-availability"
          label="Status"
          value={isAvailable ? "available" : "unavailable"}
          onChange={(next) => setIsAvailable(next === "available")}
          options={[
            { value: "available", label: "Available" },
            { value: "unavailable", label: "Unavailable" },
          ]}
        />

        {/**
         * Frame 2147236302 — "Nutrition" একটা শিরোনাম, তার নিচে চারটে
         * ছোট ঘর (Frame 2147236099: row, gap 16, প্রতিটা 156.75px)।
         *
         * ⚠️ ভেতরের label গুলো ১২px, বাইরেরটা ১৪ — Figma-তে দুটো আলাদা
         * স্তর, তাই দুটো আলাদা token। ৬৪০-এর নিচে চারটে ঘর দুই কলামে;
         * ৩২০px-এ চারটে পাশাপাশি রাখলে প্রতিটার ভাগে ~৫৮px পড়ত আর
         * ঘরগুলোয় কিছুই দেখা যেত না।
         */}
        <div className="md:col-span-2">
          <span className={LABEL}>Nutrition</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 min-[640px]:grid-cols-4">
            {(
              [
                { id: "kcal", label: "Kcal", value: calories, set: setCalories, step: "1" },
                { id: "fat", label: "Fat", value: fat, set: setFat, step: "0.1" },
                {
                  id: "protein",
                  label: "Protin",
                  value: protein,
                  set: setProtein,
                  step: "0.1",
                },
                { id: "carb", label: "Carb", value: carbs, set: setCarbs, step: "0.1" },
              ] as const
            ).map((field) => (
              <div key={field.id}>
                <label htmlFor={`menu-item-${field.id}`} className={SUB_LABEL}>
                  {field.label}
                </label>
                <input
                  id={`menu-item-${field.id}`}
                  type="number"
                  min="0"
                  step={field.step}
                  value={field.value}
                  onChange={(event) => field.set(event.target.value)}
                  placeholder="Type here"
                  className={FIELD}
                />
              </div>
            ))}
          </div>
        </div>

        {/**
         * Frame 2147236308: label + chip সারি + ("Type.." + "Add +")।
         *
         * ⚠️ Figma-র chip-এ কোনো "×" নেই, কিন্তু এখানে আছে — নাহলে ভুল
         * করে যোগ করা একটা নাম আর কখনো সরানো যেত না, আর তখন ঘরটার
         * একমাত্র শোধরানোর পথ হতো পদটাই মুছে ফেলা। একটা যোগ করার উপায়
         * থাকলে বাদ দেওয়ারও থাকতে হয়। SupplierFormModal-এ একই সিদ্ধান্ত।
         */}
        <div className="md:col-span-2">
          <span className={LABEL}>Ingredients</span>
          <p className="mb-3 font-sora text-[11px] leading-[1.6] text-black/50">
            Pick items from Inventory and how much ONE serving uses. When an order moves to
            Preparing, this amount is deducted from stock automatically.
          </p>

          {recipeStatus === "loading" && (
            <p className="mb-3 flex items-center gap-2 font-sora text-[12px] text-black/60">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Loading ingredients…
            </p>
          )}

          {recipeStatus === "error" && (
            <p className="mb-3 font-sora text-[12px] text-[#D72A37]">
              Couldn&apos;t load ingredients, so saving is paused to protect the saved recipe.{" "}
              <button
                type="button"
                onClick={() => {
                  setRecipeStatus("loading");
                  setReloadKey((k) => k + 1);
                }}
                className="underline"
              >
                Try again
              </button>
            </p>
          )}

          {recipeStatus === "ready" && (
            <div className="mb-5 space-y-2">
              {options.length === 0 && (
                <p className="font-sora text-[12px] text-black/60">
                  No inventory items yet. Add them on the Inventory page first, then come back
                  to build this recipe.
                </p>
              )}

              {rows.map((row) => {
                const option = options.find((o) => o.id === row.inventoryItemId);
                const units = option ? compatibleUnits(option.unit) : [];
                return (
                  <div key={row.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <SelectField
                      id={`recipe-item-${row.key}`}
                      label="Inventory item"
                      hideLabel
                      className="w-full min-w-0 sm:w-auto sm:flex-1"
                      value={row.inventoryItemId}
                      onChange={(value) => pickIngredient(row.key, value)}
                      options={[
                        { value: "", label: "Choose item…" },
                        // an item already used in another row can't be picked twice
                        ...options
                          .filter(
                            (o) =>
                              o.id === row.inventoryItemId ||
                              !rows.some((r) => r.inventoryItemId === o.id)
                          )
                          .map((o) => ({ value: o.id, label: o.name })),
                      ]}
                    />
                    <div className="w-24 shrink-0">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        aria-label="Quantity per serving"
                        value={row.quantity}
                        onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                        placeholder="Qty"
                        className={FIELD}
                      />
                    </div>
                    <SelectField
                      id={`recipe-unit-${row.key}`}
                      label="Unit"
                      hideLabel
                      className="w-24 shrink-0"
                      value={row.unit}
                      onChange={(value) => updateRow(row.key, { unit: value as RecipeUnit })}
                      options={(option ? units : [row.unit]).map((unit) => ({
                        value: unit,
                        label: UNIT_LABELS[unit],
                      }))}
                    />
                    {canSeeCosts && (
                      <span className="hidden w-[72px] shrink-0 text-right font-sora text-[11px] text-black/50 sm:block">
                        {(() => {
                          const line = lineBase(row);
                          return line ? money(line.qty * (line.option.costPerUnit ?? 0)) : "—";
                        })()}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                      aria-label="Remove ingredient"
                      className="flex h-[43px] w-8 shrink-0 items-center justify-center text-black/40 transition-colors hover:text-[#D72A37] focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
                    >
                      <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}

              {options.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRows((prev) => [...prev, newRow()])}
                  className="flex h-[43px] items-center gap-1.5 rounded-[12px] bg-[#F9F6F3] px-3 font-sora text-[12px] leading-none text-black transition-colors hover:bg-black/[0.06] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]"
                >
                  Add ingredient
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.2} aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {recipeStatus === "ready" && canSeeCosts && costLines.length > 0 && (
            <div className="mb-5 rounded-[12px] bg-[#F9F6F3] p-3 font-sora text-[12px] leading-[1.6] text-black/80">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-black/50">
                Cost &amp; stock · per serving
              </p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                <p>
                  Food cost: <strong>{money(foodCost.foodCost)}</strong>
                </p>
                <p>
                  Selling price: <strong>{Number.isFinite(sellingPrice) && sellingPrice > 0 ? money(sellingPrice) : "not set"}</strong>
                </p>
                <p>
                  Profit per dish:{" "}
                  <strong>{foodCost.foodCostPercent === null ? "—" : money(foodCost.grossMargin)}</strong>
                </p>
                <p>
                  Food cost %:{" "}
                  <strong
                    className={
                      costHealth === "critical"
                        ? "text-[#D72A37]"
                        : costHealth === "watch"
                          ? "text-[#C47A00]"
                          : costHealth === "healthy"
                            ? "text-[#2E8B3D]"
                            : ""
                    }
                  >
                    {foodCost.foodCostPercent === null
                      ? "enter a price"
                      : `${foodCost.foodCostPercent.toFixed(1)}% · ${
                          costHealth === "critical"
                            ? "too high"
                            : costHealth === "watch"
                              ? "watch"
                              : "healthy"
                        }`}
                  </strong>
                </p>
              </div>
              <p className="mt-2 text-[11px] text-black/50">
                Food cost % = ingredient cost ÷ selling price. Most restaurants aim for under 35%;
                above 45% the dish earns very little.
              </p>
              <p className="mt-1 text-[11px] text-black/60">
                {stockCover.servingsLeft === null
                  ? null
                  : stockCover.servingsLeft <= 0
                    ? `Stock check: not enough ${stockCover.limitingIngredient} for even one serving. Customers see this dish as Sold Out.`
                    : `Stock check: enough for about ${stockCover.servingsLeft} serving${stockCover.servingsLeft === 1 ? "" : "s"} (limited by ${stockCover.limitingIngredient}).`}
              </p>
            </div>
          )}

          <span className={LABEL}>Other ingredients</span>
          <p className="mb-3 font-sora text-[11px] leading-[1.6] text-black/50">
            Shown to customers only, not tracked in stock (e.g. salt, water).
          </p>

          {tags.length > 0 && (
            /* Frame 2147236449: row, gap 16 — chip cream, h 43, radius 12,
               padding 12, লেখা Sora 12 Black/70। `flex-wrap`, কারণ
               Figma-তে চারটে chip, বাস্তবে বিশটাও হতে পারে। */
            <div className="mb-3 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex h-[43px] items-center gap-2 rounded-[12px] bg-[#F9F6F3] px-3 font-sora text-[12px] leading-[1.6] text-black/70"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setTags((prev) => prev.filter((entry) => entry !== tag))}
                    aria-label={`Remove ${tag}`}
                    className="text-black/40 transition-colors hover:text-[#D72A37] focus:outline-none focus-visible:[outline:2px_solid_#FF9540]"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Frame 2147236448: row, gap 16 — ঘরটা flex-grow (585px),
              "Add" বোতামটা hug (74px, cream, h 43, radius 12, icon 14)। */}
          <div className="flex gap-2">
            <input
              id="menu-item-ingredient"
              type="text"
              maxLength={60}
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              // ⚠️ Enter চাপলে chip যোগ হয়, কিন্তু `preventDefault`
              // জরুরি — নাহলে Enter মানে হত "পুরো form save", আর
              // অসম্পূর্ণ অবস্থায় সংরক্ষিত হয়ে যেত।
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag();
                }
              }}
              placeholder="Type.."
              aria-label="Add an ingredient"
              className={FIELD}
            />
            <button
              type="button"
              onClick={addTag}
              className="flex h-[43px] shrink-0 items-center gap-1.5 rounded-[12px] bg-[#F9F6F3] px-3 font-sora text-[12px] leading-none text-black transition-colors hover:bg-black/[0.06] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]"
            >
              Add
              <Plus className="h-3.5 w-3.5" strokeWidth={1.2} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/**
         * ⚠️ Ingredients ঘরের নিচে আগে একটা ছোট লিঙ্ক ছিল —
         * "Edit recipe", যেটা /admin/menu/<id>/edit-এ নিয়ে যেত।
         * সরানো হয়েছে, কারণ নকশায় ওটা নেই।
         *
         * ফলে ঐ পাতাটায় এখন কোনো বোতাম বা লিঙ্ক দিয়ে **পৌঁছনো যায় না**,
         * শুধু URL হাতে লিখে। route-টা কাজ করে, আর recipe-ই stock কাটা
         * ও Insights-এর food cost-এর ভিত্তি — তাই ওই কাজটা দরকার হলে
         * এখানে বা তালিকার সারিতে একটা পথ ফিরিয়ে আনতে হবে।
         */}

        {/**
         * Frame 2147236303: Food Status │ Prep Time, দুটোই 329.5px।
         *
         * ⚠️ Figma-তে ডানের ঘরটার label "Mead Time" — ইংরেজিতে ওরকম
         * কোনো শব্দ নেই (mead মানে মধুর মদ), অর্থাৎ mockup-এ বানানটা
         * ভুল। মেনু-তালিকার কলামের নাম "Nutrition & Time" আর ওখানে
         * ক্যালরির পাশেই সংখ্যাটা বসে, তাই এটা রান্নার সময়।
         *
         * পর্দায় লেখা হয় "Prep Time" — রেস্তোরাঁর প্রচলিত শব্দ, আর
         * মাঠের নামও (`prepTimeMinutes`) তাই। mockup-এর ভুল বানানটা
         * রেখে দিলে যিনি প্যানেল চালাবেন তিনিও একই প্রশ্নে আটকাতেন।
         */}
        <div>
          <label htmlFor="menu-item-food-status" className={LABEL}>
            Food Status
          </label>
          <input
            id="menu-item-food-status"
            type="text"
            maxLength={40}
            value={foodStatus}
            onChange={(event) => setFoodStatus(event.target.value)}
            // ⚠️ উপরের "Status" ঘরটার সাথে গুলিয়ে যাওয়া সহজ, তাই
            // placeholder-এ উদাহরণ — "Type here" লিখলে কেউ বুঝত না
            // ঘরটা কী চায়। ওটা "এখন পাওয়া যাচ্ছে কিনা", এটা "কী জিনিস"।
            placeholder="Veg, Non-veg, Spicy…"
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="menu-item-prep-time" className={LABEL}>
            Prep Time (minutes)
          </label>
          <input
            id="menu-item-prep-time"
            type="number"
            min="0"
            step="1"
            value={prepTime}
            onChange={(event) => setPrepTime(event.target.value)}
            placeholder="Type here"
            className={FIELD}
          />
        </div>
      </div>
    </ModalShell>
  );
}
