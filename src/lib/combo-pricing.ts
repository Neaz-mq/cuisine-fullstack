import { formatAmount } from "@/lib/currency-format";
import { ZERO, roundMoney, toMoney, type Money, type MoneyInput } from "@/lib/money";
import { effectivePrice, type LiveOffer } from "@/lib/product-offers";

/**
 * src/lib/combo-pricing.ts
 *
 * Pure helpers for the home page "Combo Deals" section (no database).
 *
 * A combo has no price of its own. It is a bundle of real MenuItems plus a
 * discount percent. Its price is the sum of what each component costs TODAY
 * (menu price, with any live ProductOffer), reduced by the combo's discount.
 *
 * The discount is applied on the SERVER at checkout by applyComboDiscounts
 * (called from resolveOrderItems): whenever a cart contains every item of an
 * active combo, those units are charged the discounted price. The cart sends
 * only item ids and quantities, so nothing the browser says can change a
 * price — and the card here, the cart and the final charge use the same
 * comboUnitPrice, so they cannot drift apart.
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

/**
 * One unit's price inside a combo: the unit price reduced by `percent`,
 * rounded to the currency's minor units. The single rounding rule used by the
 * home card, the cart quote and the order, so all three always agree.
 */
export function comboUnitPrice(price: MoneyInput, percent: number, minorUnits: number): Money {
  return roundMoney(toMoney(price).times(100 - percent).dividedBy(100), minorUnits);
}

export function priceCombo(
  components: ComboComponent[],
  offers: Map<string, LiveOffer>,
  isMember: boolean,
  currency: string,
  minorUnits: number,
  discountPercent: number = 0
): PricedCombo {
  let total = ZERO;
  let was = ZERO;
  const lines: ComboCartLine[] = [];

  for (const c of components) {
    const shown = effectivePrice(c.price, offers.get(c.id), isMember, minorUnits);
    const unit = comboUnitPrice(shown.price, discountPercent, minorUnits);
    total = total.plus(unit.times(c.quantity));
    was = was.plus(toMoney(c.price).times(c.quantity));
    lines.push({
      id: c.id,
      title: c.title,
      price: unit.toNumber(),
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

/* ── Checkout: applying combo discounts to a cart ───────────────────────── */

export type ComboRule = {
  id: string;
  /** 1–90. 0 means the combo gives no discount and is ignored. */
  discountPercent: number;
  items: { menuItemId: string; quantity: number }[];
};

export type PriceableCartLine = {
  menuItemId: string;
  quantity: number;
  price: Money;
  originalPrice: Money | null;
};

/**
 * Applies combo discounts to resolved cart lines.
 *
 * A combo "fits" once for every full set of its items in the cart: it needs
 * each component's quantity at least once. N full sets discount N × quantity
 * units of each component; extra units are charged normally. Combos are tried
 * in the order given (the admin's display order), and a unit discounted by one
 * combo cannot be discounted by another.
 *
 * A line only part-covered by a combo is split in two — the discounted units
 * and the rest — so every unit is charged exactly its own price and the
 * subtotal needs no rounding fix-ups. The discounted units keep the pre-combo
 * menu price in `originalPrice`, like a product offer does.
 *
 * Returns new lines; the input is not changed. `savings` is the total taken
 * off by combos, for the cart's "combo savings" note.
 */
export function applyComboDiscounts<T extends PriceableCartLine>(
  lines: T[],
  combos: ComboRule[],
  minorUnits: number
): { lines: T[]; savings: Money } {
  const available = new Map<string, number>();
  for (const line of lines) {
    available.set(line.menuItemId, (available.get(line.menuItemId) ?? 0) + line.quantity);
  }

  // menuItemId → chunks of units that a combo discounts, and by how much.
  const pool = new Map<string, { units: number; percent: number }[]>();

  for (const combo of combos) {
    if (combo.discountPercent <= 0 || combo.items.length === 0) continue;

    const sets = Math.min(
      ...combo.items.map((i) => Math.floor((available.get(i.menuItemId) ?? 0) / i.quantity))
    );
    if (!Number.isFinite(sets) || sets < 1) continue;

    for (const item of combo.items) {
      const units = sets * item.quantity;
      available.set(item.menuItemId, (available.get(item.menuItemId) ?? 0) - units);
      const chunks = pool.get(item.menuItemId) ?? [];
      chunks.push({ units, percent: combo.discountPercent });
      pool.set(item.menuItemId, chunks);
    }
  }

  let savings = ZERO;
  const out: T[] = [];

  for (const line of lines) {
    let remaining = line.quantity;
    const chunks = pool.get(line.menuItemId) ?? [];

    while (remaining > 0 && chunks.length > 0) {
      const chunk = chunks[0];
      const units = Math.min(remaining, chunk.units);
      const discounted = comboUnitPrice(line.price, chunk.percent, minorUnits);

      out.push({
        ...line,
        quantity: units,
        price: discounted,
        originalPrice: line.originalPrice ?? line.price,
      });
      savings = savings.plus(line.price.minus(discounted).times(units));

      remaining -= units;
      chunk.units -= units;
      if (chunk.units === 0) chunks.shift();
    }

    if (remaining > 0) out.push({ ...line, quantity: remaining });
  }

  return { lines: out, savings };
}