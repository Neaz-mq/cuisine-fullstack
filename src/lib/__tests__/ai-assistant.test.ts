import { describe, it, expect } from "vitest";
import {
  basicReply,
  buildSystemPrompt,
  dishesForPrompt,
  parseBudget,
  parseModelReply,
  rankDishes,
  type AssistantContext,
  type AssistantDish,
} from "@/lib/ai-assistant/core";

const dish = (over: Partial<AssistantDish>): AssistantDish => ({
  id: "x",
  title: "Dish",
  category: "Mains",
  description: "",
  price: 10,
  priceLabel: "$10.00",
  oldPriceLabel: null,
  badge: null,
  imageUrl: null,
  foodStatus: null,
  tags: [],
  calories: null,
  proteinGrams: null,
  prepTimeMinutes: null,
  rating: null,
  reviewCount: 0,
  soldRecently: 0,
  ...over,
});

const menu = [
  dish({ id: "a", title: "Spicy Chicken Burger", category: "Burgers", price: 12, foodStatus: "Spicy", soldRecently: 5 }),
  dish({ id: "b", title: "Veggie Pizza", category: "Pizza", price: 18, foodStatus: "Veg", tags: ["mushroom"] }),
  dish({ id: "c", title: "Beef Steak", category: "Mains", price: 30, soldRecently: 40 }),
  dish({ id: "d", title: "Mango Lassi", category: "Drinks", price: 4, oldPriceLabel: "$5.00", badge: "20% Off" }),
];

const context = (over: Partial<AssistantContext> = {}): AssistantContext => ({
  currency: "USD",
  nowLabel: "Friday 7:00 PM",
  kitchenOpen: true,
  hoursLabel: "10:00 AM – 10:00 PM every day",
  deliveryLabel: "flat fee $2.00",
  dishes: menu,
  coupons: ["SAVE20 — 20% off"],
  user: null,
  cart: [],
  ...over,
});

describe("parseBudget", () => {
  it("reads English and Bangla price limits", () => {
    expect(parseBudget("something spicy under $15")).toBe(15);
    expect(parseBudget("less than 20 please")).toBe(20);
    expect(parseBudget("৩০০ টাকার মধ্যে কী আছে")).toBe(300);
    expect(parseBudget("dinner for 3")).toBeNull();
  });
});

describe("rankDishes", () => {
  it("finds dishes by synonyms, including Bangla", () => {
    expect(rankDishes(menu, "something hot")[0].dish.id).toBe("a");
    expect(rankDishes(menu, "নিরামিষ কী আছে")[0].dish.id).toBe("b");
  });

  it("respects a budget", () => {
    const ids = rankDishes(menu, "anything under 15").map((r) => r.dish.id);
    expect(ids).not.toContain("b");
    expect(ids).not.toContain("c");
  });

  it("falls back to popularity when nothing matches", () => {
    expect(rankDishes(menu, "surprise me")[0].dish.id).toBe("c");
  });
});

describe("dishesForPrompt", () => {
  it("keeps the prompt small on a big menu", () => {
    const big = Array.from({ length: 120 }, (_, i) => dish({ id: `d${i}`, title: `Dish ${i}` }));
    expect(dishesForPrompt(big, "pizza", 40)).toHaveLength(40);
  });
});

describe("parseModelReply", () => {
  const known = new Set(["a", "b"]);

  it("keeps only real dish ids and caps suggestions", () => {
    const parsed = parseModelReply(
      JSON.stringify({ reply: "Try these", dishIds: ["a", "zzz", "a", "b"], suggestions: ["1", "2", "3", "4"], showOrders: false }),
      known
    );
    expect(parsed?.dishIds).toEqual(["a", "b"]);
    expect(parsed?.suggestions).toHaveLength(3);
  });

  it("digs JSON out of extra text, and rejects an empty reply", () => {
    expect(parseModelReply('Sure! {"reply":"Hi","dishIds":[]}', known)?.reply).toBe("Hi");
    expect(parseModelReply('{"reply":""}', known)).toBeNull();
    expect(parseModelReply("not json", known)).toBeNull();
  });
});

describe("basicReply (no AI)", () => {
  it("lists coupon codes for an offers question", () => {
    expect(basicReply(context(), "any offers?").reply).toContain("SAVE20");
  });

  it("asks guests to sign in for their orders", () => {
    expect(basicReply(context(), "where is my order").reply).toMatch(/sign in/i);
  });

  it("shows a signed-in customer's orders", () => {
    const user = {
      firstName: "Hasan",
      points: 91,
      tier: "Bronze",
      nextTier: "Silver",
      pointsToNextTier: 109,
      tierPerks: "",
      earnRule: null,
      redeemRule: "20 points = $1 off",
      orders: [{ label: "#ORD-1", status: "Preparing", placedAt: "", items: "", total: "", href: "/track/1" }],
    };
    expect(basicReply(context({ user }), "track my order").orders).toHaveLength(1);
    expect(basicReply(context({ user }), "how many points do I have").reply).toContain("91");
  });

  it("answers in Bangla when asked in Bangla", () => {
    expect(basicReply(context(), "কখন খোলা থাকে?").reply).toContain("খোলা");
  });
});

describe("buildSystemPrompt", () => {
  it("contains the menu ids, the rules and the guest note", () => {
    const prompt = buildSystemPrompt(context(), menu);
    expect(prompt).toContain("[a] Spicy Chicken Burger");
    expect(prompt).toContain("Answer with JSON only");
    expect(prompt).toContain("a guest");
  });
});

import { directIntent } from "@/lib/ai-assistant/core";

describe("directIntent", () => {
  it("routes order questions to the database, for guests too", () => {
    expect(directIntent("Where's my order?", true)).toBe("order");
    expect(directIntent("আমার অর্ডার কোথায়?", false)).toBe("order");
  });

  it("routes a signed-in customer's own points question", () => {
    expect(directIntent("How many points do I have?", true)).toBe("points");
    expect(directIntent("আমার কত পয়েন্ট আছে?", true)).toBe("points");
    expect(directIntent("How do loyalty points work?", false)).toBeNull();
  });

  it("leaves menu questions to the model", () => {
    expect(directIntent("Something spicy under $15", true)).toBeNull();
  });
});

describe("delivery answers", () => {
  const withZones = context({
    delivery: {
      mode: "DISTANCE",
      flatFee: "$2.00",
      zones: [
        { label: "0–1 km", fee: "$2.00" },
        { label: "1–3 km", fee: "$5.00" },
      ],
      maxKm: 3,
    },
  });

  it("is looked up directly and lists every zone", () => {
    expect(directIntent("How much is delivery?", false)).toBe("delivery");
    const reply = basicReply(withZones, "How much is delivery?").reply;
    expect(reply).toContain("1–3 km: $5.00");
    expect(reply).toContain("beyond 3 km");
  });

  it("answers in Bangla", () => {
    expect(basicReply(withZones, "ডেলিভারি চার্জ কত?").reply).toContain("দূরত্ব অনুযায়ী");
  });
});
