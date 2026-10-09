import { formatAmount } from "@/lib/currency-format";
import { ZERO, toMoney, type MoneyInput } from "@/lib/money";
import { effectivePrice, type LiveOffer } from "@/lib/product-offers";

/**
 * src/lib/combo-pricing.ts
 *
 * Pure helpers for the home page "Combo Deals" section (no database).
 *
 * A combo has no price of its own. It is a bundle of real MenuItems, and its
 * price is the sum of what each component costs TODAY — menu price with any
 * live ProductOffer applied, exactly like the menu page and checkout do.
 * That is what keeps the card, the cart and the final charge in agreement:
 * checkout re-prices every line from MenuItem + ProductOffer on the server,
 * so a combo-specific price could never be charged.
 */

/** How many combos the home page shows. The admin list uses it to flag the rest. */
export const HOME_COMBO_LIMIT = 3;

export type ComboComponent = {
  id: string;
  title: string;
  price: MoneyInput;
  imageUrl: string | null;
  calories: number | null;
  fatGrams: number | null;
  proteinGrams: number | null;
  prepTimeMinutes: number | null;
  quantity: number;
};

/** One cart line. `price` is display-only — the server re-prices at checkout. */
export type ComboCartLine = {
  id: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
};

/** Serializable (server → client component) card data. */
export type ComboDeal = {
  id: string;
  name: string;
  rating: string | null;
  discount: string | null;
  chips: string[];
  includes: string[];
  description: string;
  price: string;
  wasPrice: string | null;
  image: string | null;
  lines: ComboCartLine[];
};

export type PricedCombo = {
  price: string;
  wasPrice: string | null;
  discount: string | null;
  lines: ComboCartLine[];
};

export function priceCombo(
  components: ComboComponent[],
  offers: Map<string, LiveOffer>,
  isMember: boolean,
  currency: string,
  minorUnits: number
): PricedCombo {
  let total = ZERO;
  let was = ZERO;
  const lines: ComboCartLine[] = [];

  for (const c of components) {
    const shown = effectivePrice(c.price, offers.get(c.id), isMember, minorUnits);
    total = total.plus(shown.price.times(c.quantity));
    was = was.plus(toMoney(c.price).times(c.quantity));
    lines.push({
      id: c.id,
      title: c.title,
      price: shown.price.toNumber(),
      quantity: c.quantity,
      imageUrl: c.imageUrl,
    });
  }

  const hasSaving = was.gt(0) && total.lt(was);
  const percent = hasSaving ? Math.round(was.minus(total).div(was).times(100).toNumber()) : 0;
  const label = (value: typeof total) => formatAmount(value.toFixed(minorUnits), currency);

  return {
    price: label(total),
    wasPrice: hasSaving ? label(was) : null,
    discount: percent >= 1 ? `${percent}%` : null,
    lines,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Nutrition chips. A figure is shown only when EVERY component has it — a sum
 * over a partial set would understate the real total. Prep time is the longest
 * component (kitchen cooks them in parallel).
 */
export function comboChips(components: ComboComponent[]): string[] {
  const chips: string[] = [];

  const times = components
    .map((c) => c.prepTimeMinutes)
    .filter((t): t is number => t !== null);
  if (times.length > 0) chips.push(`${Math.max(...times)} min`);

  const total = (pick: (c: ComboComponent) => number | null): number | null => {
    let sum = 0;
    for (const c of components) {
      const v = pick(c);
      if (v === null) return null;
      sum += v * c.quantity;
    }
    return sum;
  };

  const kcal = total((c) => c.calories);
  const fats = total((c) => c.fatGrams);
  const protein = total((c) => c.proteinGrams);
  if (kcal !== null) chips.push(`${Math.round(kcal)} kcal`);
  if (fats !== null) chips.push(`${round1(fats)} Fats`);
  if (protein !== null) chips.push(`${round1(protein)} Protein`);

  return chips;
}

export function comboIncludes(components: ComboComponent[]): string[] {
  return components.map((c) => (c.quantity > 1 ? `${c.quantity} × ${c.title}` : c.title));
}

/** Review-count-weighted average across the components. null if nobody reviewed. */
export function pooledRating(
  rows: { average: number | null; count: number }[]
): string | null {
  let count = 0;
  let weighted = 0;
  for (const row of rows) {
    if (row.average === null || row.count === 0) continue;
    count += row.count;
    weighted += row.average * row.count;
  }
  return count > 0 ? (weighted / count).toFixed(1) : null;
}

export type ComboStatusKind = "live" | "waiting" | "hidden" | "unavailable";

export type ComboStatus = {
  kind: ComboStatusKind;
  label: string;
  /** One line telling the admin why — what to change to get it onto the home page. */
  detail: string | null;
};

/**
 * Whether each combo is actually on the home page, so the admin list can say so
 * instead of leaving the owner to wonder why a combo they added is missing.
 *
 * `combos` must be in home-page order (sortOrder, then createdAt). Mirrors
 * getHomeCombos: inactive and not-fully-available combos are skipped, then only
 * the first HOME_COMBO_LIMIT are shown.
 */
export function comboStatuses(
  combos: { id: string; isActive: boolean; items: { title: string; isAvailable: boolean }[] }[],
  limit: number = HOME_COMBO_LIMIT
): Map<string, ComboStatus> {
  const result = new Map<string, ComboStatus>();
  let shown = 0;

  for (const combo of combos) {
    if (!combo.isActive) {
      result.set(combo.id, {
        kind: "hidden",
        label: "Hidden",
        detail: "Switched off, so it is not on the home page.",
      });
      continue;
    }

    const missing = combo.items.filter((i) => !i.isAvailable).map((i) => i.title);
    if (combo.items.length === 0 || missing.length > 0) {
      result.set(combo.id, {
        kind: "unavailable",
        label: "Not shown",
        detail:
          missing.length > 0
            ? `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} unavailable on the menu.`
            : "This combo has no items.",
      });
      continue;
    }

    shown += 1;
    result.set(
      combo.id,
      shown <= limit
        ? { kind: "live", label: "On home page", detail: null }
        : {
            kind: "waiting",
            label: "Not shown yet",
            detail: `The home page shows ${limit} combos. Lower this one's display order or hide another combo.`,
          }
    );
  }

  return result;
}