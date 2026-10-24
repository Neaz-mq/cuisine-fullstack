import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSupplierOrderToken,
  purchaseOrderRef,
  readSupplierOrderToken,
} from "@/lib/supplier-order-token";

const ID = "cmvm1ego00000is4utqnf2hvu";

describe("supplier order token", () => {
  const saved = { auth: process.env.AUTH_SECRET, next: process.env.NEXTAUTH_SECRET };

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-one";
    delete process.env.NEXTAUTH_SECRET;
  });

  afterEach(() => {
    if (saved.auth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = saved.auth;
    if (saved.next === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = saved.next;
  });

  it("round-trips a purchase order id", () => {
    expect(readSupplierOrderToken(createSupplierOrderToken(ID))).toBe(ID);
  });

  it("is stable, so a resent email carries the same link", () => {
    expect(createSupplierOrderToken(ID)).toBe(createSupplierOrderToken(ID));
  });

  it("rejects a tampered signature or id", () => {
    const token = createSupplierOrderToken(ID);
    expect(readSupplierOrderToken(token.slice(0, -2) + "xx")).toBeNull();
    expect(readSupplierOrderToken(token.replace(ID, "cmvm1ego00000is4utqnf2hvv"))).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSupplierOrderToken(ID);
    process.env.AUTH_SECRET = "test-secret-two";
    expect(readSupplierOrderToken(token)).toBeNull();
  });

  it("rejects malformed input without throwing", () => {
    expect(readSupplierOrderToken(undefined)).toBeNull();
    expect(readSupplierOrderToken("")).toBeNull();
    expect(readSupplierOrderToken("nodot")).toBeNull();
    expect(readSupplierOrderToken(".sig")).toBeNull();
    expect(readSupplierOrderToken(`${ID}.`)).toBeNull();
    expect(readSupplierOrderToken("../../etc.passwd")).toBeNull();
    expect(readSupplierOrderToken("x".repeat(500))).toBeNull();
  });

  it("refuses to sign, and to verify, without an app secret", () => {
    delete process.env.AUTH_SECRET;
    expect(() => createSupplierOrderToken(ID)).toThrow();
    expect(readSupplierOrderToken(`${ID}.abc`)).toBeNull();
  });

  it("builds a short reference", () => {
    expect(purchaseOrderRef(ID)).toBe(`PO-${ID.slice(-6).toUpperCase()}`);
  });
});
