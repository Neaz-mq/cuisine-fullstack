import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * src/lib/__tests__/order-access.test.ts
 *
 * "@/auth" আর "@/lib/prisma" পুরোপুরি mock করা — require-admin.test.ts
 * এর হুবহু একই কৌশল, তাই এই suite-এর জন্য কোনো NextAuth session, live
 * database বা generated Prisma client লাগে না।
 *
 * যেটা পরীক্ষা হচ্ছে সেটা হলো সেই সিদ্ধান্তটা, যেটা আগে কোথাও ছিলই না:
 * GET /api/orders/[id] আর /track/[orderId] দুটোই auth ছাড়া চলতো, ফলে
 * order id জানা যেকোনো লোক গ্রাহকের নাম, শহর, পুরো চালান আর rider-এর
 * live GPS পড়তে পারতো।
 *
 * এখানে যে দুটো কেস সবচেয়ে গুরুত্বপূর্ণ:
 *
 *   ১. guest order (userId === null) এখনো খোলা থাকতে *হবে* — নইলে
 *      guest checkout-এর গ্রাহক নিজের order-ই দেখতে পারবে না, কারণ
 *      তার log in করার কোনো উপায় নেই।
 *
 *   ২. account-এ bound order অন্য কারো কাছে বন্ধ থাকতে হবে — এটাই
 *      আসল ফাঁকটা যেটা বন্ধ করা হয়েছে।
 */

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

const mockUserFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
  },
}));

import { resolveOrderAccess, canSeeRiderLocation } from "@/lib/order-access";

/** NextAuth session shape. এখানকার `role` ইচ্ছাকৃতভাবে অগ্রাহ্য হয় —
 *  loadActiveRole database থেকে পড়ে। কয়েকটা test সেটা প্রমাণ করে। */
function session(id: string, role = "USER") {
  return { user: { id, role } };
}

/** prisma.user.findUnique যা resolve করে: authoritative role +
 *  staffProfile.isActive. */
function dbUser(role: string, isActive = true) {
  return {
    role,
    staffProfile: role === "USER" ? null : { isActive },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(null);
  mockUserFindUnique.mockResolvedValue(null);
});

describe("resolveOrderAccess — guest orders (userId === null)", () => {
  it("লগইন ছাড়া guest order দেখা যায় — id-ই টিকিট", async () => {
    expect(await resolveOrderAccess({ userId: null })).toBe("bearer");
  });

  it("অন্য কোনো লগইন করা গ্রাহকও guest order দেখতে পারে", async () => {
    mockAuth.mockResolvedValue(session("someone-else"));
    mockUserFindUnique.mockResolvedValue(dbUser("USER"));

    expect(await resolveOrderAccess({ userId: null })).toBe("bearer");
  });
});

describe("resolveOrderAccess — account-এ bound order", () => {
  it("যার order, সে দেখতে পায়", async () => {
    mockAuth.mockResolvedValue(session("user-1"));
    mockUserFindUnique.mockResolvedValue(dbUser("USER"));

    expect(await resolveOrderAccess({ userId: "user-1" })).toBe("owner");
  });

  it("⚠️ অন্য গ্রাহক দেখতে পায় না — এটাই বন্ধ করা ফাঁকটা", async () => {
    mockAuth.mockResolvedValue(session("user-2"));
    mockUserFindUnique.mockResolvedValue(dbUser("USER"));

    expect(await resolveOrderAccess({ userId: "user-1" })).toBeNull();
  });

  it("⚠️ লগইন না করা কেউ id জানলেও দেখতে পায় না", async () => {
    expect(await resolveOrderAccess({ userId: "user-1" })).toBeNull();
  });
});

describe("resolveOrderAccess — staff", () => {
  it("MANAGER যেকোনো order দেখতে পায়", async () => {
    mockAuth.mockResolvedValue(session("staff-1"));
    mockUserFindUnique.mockResolvedValue(dbUser("MANAGER"));

    expect(await resolveOrderAccess({ userId: "someone-else" })).toBe("staff");
  });

  it("KITCHEN role-ও পায় — kitchen scope গোনা হয়", async () => {
    mockAuth.mockResolvedValue(session("staff-2"));
    mockUserFindUnique.mockResolvedValue(dbUser("KITCHEN"));

    expect(await resolveOrderAccess({ userId: "someone-else" })).toBe("staff");
  });

  it("DELIVERY rider পায় না — তার scope কেবল myDeliveries", async () => {
    mockAuth.mockResolvedValue(session("rider-1"));
    mockUserFindUnique.mockResolvedValue(dbUser("DELIVERY"));

    expect(await resolveOrderAccess({ userId: "someone-else" })).toBeNull();
  });

  it("নিষ্ক্রিয় করা MANAGER পায় না", async () => {
    mockAuth.mockResolvedValue(session("staff-3"));
    mockUserFindUnique.mockResolvedValue(dbUser("MANAGER", false));

    expect(await resolveOrderAccess({ userId: "someone-else" })).toBeNull();
  });

  it("session-এর role নয়, database-এর role-ই সিদ্ধান্ত নেয়", async () => {
    // JWT বলছে MANAGER, database বলছে সাধারণ গ্রাহক — demote করার পর
    // পুরোনো token সপ্তাহখানেক বেঁচে থাকে।
    mockAuth.mockResolvedValue(session("demoted-1", "MANAGER"));
    mockUserFindUnique.mockResolvedValue(dbUser("USER"));

    expect(await resolveOrderAccess({ userId: "someone-else" })).toBeNull();
  });

  it("staff নিজের order-এও staff হিসেবেই গোনা হয়", async () => {
    mockAuth.mockResolvedValue(session("staff-4"));
    mockUserFindUnique.mockResolvedValue(dbUser("MANAGER"));

    expect(await resolveOrderAccess({ userId: "staff-4" })).toBe("staff");
  });
});

describe("canSeeRiderLocation", () => {
  const tracking = (deliveredAt: Date | null) => ({ deliveredAt });

  it("পথে থাকা order-এ স্থানাঙ্ক দেখানো যায়", () => {
    expect(
      canSeeRiderLocation({ status: "OUT_FOR_DELIVERY", deliveryTracking: tracking(null) })
    ).toBe(true);
  });

  it("ডেলিভারি হয়ে গেলে আর নয় — তখন ওটা কর্মী নজরদারি", () => {
    expect(
      canSeeRiderLocation({
        status: "OUT_FOR_DELIVERY",
        deliveryTracking: tracking(new Date()),
      })
    ).toBe(false);
  });

  it("এখনো রওনা হয়নি এমন order-এও নয়", () => {
    expect(
      canSeeRiderLocation({ status: "PREPARING", deliveryTracking: tracking(null) })
    ).toBe(false);
  });

  it("বাতিল হওয়া order-এও নয়", () => {
    expect(
      canSeeRiderLocation({ status: "CANCELLED", deliveryTracking: tracking(null) })
    ).toBe(false);
  });

  it("tracking row না থাকলে নয়", () => {
    expect(
      canSeeRiderLocation({ status: "OUT_FOR_DELIVERY", deliveryTracking: null })
    ).toBe(false);
  });
});
