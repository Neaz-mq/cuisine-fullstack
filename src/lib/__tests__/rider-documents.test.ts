import { describe, expect, it } from "vitest";
import { daysUntil, describeAllDocuments, describeDocument, sniffDocumentType } from "@/lib/rider-documents";
import { documentDecisionSchema, riderProfileSchema } from "@/lib/validations/delivery";

const today = new Date(2026, 8, 30); // Sep 30, 2026 (local)
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const doc = (over: Partial<Parameters<typeof describeDocument>[1] & object> = {}) => ({
  type: "DRIVING_LICENSE",
  status: "VERIFIED" as const,
  expiresAt: utc(2028, 1, 1),
  uploadedAt: new Date(2026, 8, 1),
  fileName: "dl.jpg",
  note: null,
  ...over,
});

describe("describeDocument", () => {
  it("shows missing documents with an Upload action", () => {
    expect(describeDocument("INSURANCE", undefined, today)).toMatchObject({ state: "MISSING", detail: "Not uploaded yet" });
  });
  it("marks a pending upload as in review", () => {
    expect(describeDocument("DRIVING_LICENSE", doc({ status: "PENDING" }), today).state).toBe("PENDING");
  });
  it("warns 30 days before a verified document expires", () => {
    const view = describeDocument("DRIVING_LICENSE", doc({ expiresAt: utc(2026, 10, 12) }), today);
    expect(view).toMatchObject({ state: "RENEW_SOON", detail: "Expires in 12 days" });
  });
  it("flags an expired document", () => {
    expect(describeDocument("DRIVING_LICENSE", doc({ expiresAt: utc(2026, 9, 29) }), today).state).toBe("EXPIRED");
  });
  it("shows the reason on a rejected upload", () => {
    const view = describeDocument("DRIVING_LICENSE", doc({ status: "REJECTED", note: "Blurry photo" }), today);
    expect(view).toMatchObject({ state: "REJECTED", detail: "Rejected: Blurry photo" });
  });
  it("lists all three kinds in order", () => {
    expect(describeAllDocuments([doc()], today).map((d) => [d.type, d.state])).toEqual([
      ["DRIVING_LICENSE", "VERIFIED"],
      ["VEHICLE_REGISTRATION", "MISSING"],
      ["INSURANCE", "MISSING"],
    ]);
  });
  it("counts whole calendar days", () => {
    expect(daysUntil(utc(2026, 9, 30), today)).toBe(0);
    expect(daysUntil(utc(2026, 10, 1), today)).toBe(1);
  });
});

describe("sniffDocumentType", () => {
  it("trusts the bytes, not the name", () => {
    expect(sniffDocumentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffDocumentType(new TextEncoder().encode("%PDF-1.7 ..."))).toBe("application/pdf");
    expect(sniffDocumentType(new TextEncoder().encode("MZ executable"))).toBeNull();
  });
});

describe("rider profile validation", () => {
  const base = {
    name: "Ridoy Ahmed",
    phone: "",
    address: "Nishindara, Bogura",
    nid: "2356 7654 8634 1",
    dateOfBirth: "",
    gender: "",
    vehicleType: "Motorbike",
    vehicleModel: "",
    vehiclePlate: "dhk-4821",
    drivingLicenseNumber: "dl-99213847",
  };
  it("accepts a 13-digit NID with spaces and upper-cases plate and licence", () => {
    const parsed = riderProfileSchema.parse(base);
    expect(parsed).toMatchObject({ nid: "2356765486341", vehiclePlate: "DHK-4821", drivingLicenseNumber: "DL-99213847" });
  });
  it("rejects an NID of the wrong length", () => {
    expect(riderProfileSchema.safeParse({ ...base, nid: "12345" }).success).toBe(false);
  });
  it("needs a reason to reject a document", () => {
    expect(documentDecisionSchema.safeParse({ action: "REJECTED", note: "" }).success).toBe(false);
    expect(documentDecisionSchema.safeParse({ action: "VERIFIED" }).success).toBe(true);
  });
});
