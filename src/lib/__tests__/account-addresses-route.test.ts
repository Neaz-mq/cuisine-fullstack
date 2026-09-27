import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/account/addresses — the customer address book.
 * Rules: first address becomes the default, at most 10, and another
 * customer's address can't be edited or deleted.
 */

let sessionUser: { id: string } | null = { id: "me" };
vi.mock("@/auth", () => ({ auth: async () => (sessionUser ? { user: sessionUser } : null) }));

type Row = { id: string; userId: string; isDefault: boolean; updatedAt: Date; [k: string]: unknown };
let rows: Row[] = [];

const tx = {
  customerAddress: {
    count: async ({ where }: { where: { userId: string } }) => rows.filter((r) => r.userId === where.userId).length,
    updateMany: async ({ where, data }: { where: { userId: string }; data: Partial<Row> }) => {
      rows = rows.map((r) => (r.userId === where.userId ? { ...r, ...data } : r));
    },
    create: async ({ data }: { data: Omit<Row, "id" | "updatedAt"> }) => {
      const row = { ...data, id: `new-${rows.length}`, updatedAt: new Date() } as Row;
      rows.push(row);
      return row;
    },
    findFirst: async ({ where }: { where: { id?: string; userId: string } }) =>
      rows.find((r) => r.userId === where.userId && (!where.id || r.id === where.id)) ?? null,
    delete: async ({ where }: { where: { id: string } }) => {
      rows = rows.filter((r) => r.id !== where.id);
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      rows = rows.map((r) => (r.id === where.id ? { ...r, ...data } : r));
      return rows.find((r) => r.id === where.id);
    },
  },
};
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
}));

import { POST } from "@/app/api/account/addresses/route";
import { DELETE } from "@/app/api/account/addresses/[id]/route";

const body = { label: "Home", address: "Road 11", city: "Bogura", state: "Rajshahi", zip: "5800" };
const post = (data: object) =>
  POST(new Request("http://x/api/account/addresses", { method: "POST", body: JSON.stringify(data) }));

beforeEach(() => {
  rows = [];
  sessionUser = { id: "me" };
});

describe("POST /api/account/addresses", () => {
  it("makes the first address the default", async () => {
    const res = await post(body);
    expect(res.status).toBe(201);
    expect((await res.json()).address.isDefault).toBe(true);
  });

  it("moves the default when a new one asks for it", async () => {
    await post(body);
    await post({ ...body, label: "Work", isDefault: true });
    expect(rows.filter((r) => r.isDefault).map((r) => r.label)).toEqual(["Work"]);
  });

  it("stops at 10 addresses", async () => {
    for (let i = 0; i < 10; i++) await post({ ...body, label: `A${i}` });
    const res = await post(body);
    expect(res.status).toBe(409);
  });

  it("needs a signed-in customer", async () => {
    sessionUser = null;
    expect((await post(body)).status).toBe(401);
  });
});

describe("DELETE /api/account/addresses/[id]", () => {
  it("can't delete someone else's address", async () => {
    rows.push({ id: "theirs", userId: "other", isDefault: true, updatedAt: new Date(), label: "Home" });
    const res = await DELETE(new Request("http://x"), { params: Promise.resolve({ id: "theirs" }) });
    expect(res.status).toBe(404);
    expect(rows).toHaveLength(1);
  });

  it("passes 'default' on to another address", async () => {
    await post(body);
    await post({ ...body, label: "Work" });
    const defaultId = rows.find((r) => r.isDefault)!.id;
    const res = await DELETE(new Request("http://x"), { params: Promise.resolve({ id: defaultId }) });
    expect(res.status).toBe(200);
    expect(rows).toHaveLength(1);
    expect(rows[0].isDefault).toBe(true);
  });
});
