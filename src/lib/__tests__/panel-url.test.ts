import { describe, it, expect } from "vitest";
import { publicPrefixForRole, toInternalPath, toPublicPath } from "@/lib/panel-url";

describe("KITCHEN panel URLs", () => {
  it("browses under /kitchen", () => {
    expect(publicPrefixForRole("KITCHEN")).toBe("/kitchen");
  });

  it("maps public → internal", () => {
    expect(toInternalPath("/kitchen")).toBe("/admin");
    expect(toInternalPath("/kitchen/live-orders")).toBe("/admin/kitchen");
    expect(toInternalPath("/kitchen/prep")).toBe("/admin/kitchen/prep");
    expect(toInternalPath("/kitchen/inventory")).toBe("/admin/kitchen/inventory");
    expect(toInternalPath("/kitchen/profile")).toBe("/admin/profile");
  });

  it("maps internal → public", () => {
    expect(toPublicPath("KITCHEN", "/admin")).toBe("/kitchen");
    expect(toPublicPath("KITCHEN", "/admin/kitchen")).toBe("/kitchen/live-orders");
    expect(toPublicPath("KITCHEN", "/admin/kitchen/prep")).toBe("/kitchen/prep");
    expect(toPublicPath("KITCHEN", "/admin/kitchen/inventory")).toBe("/kitchen/inventory");
    expect(toPublicPath("KITCHEN", "/admin/profile")).toBe("/kitchen/profile");
  });

  it("round-trips every kitchen page", () => {
    for (const internal of ["/admin", "/admin/kitchen", "/admin/kitchen/prep", "/admin/kitchen/inventory", "/admin/profile"]) {
      expect(toInternalPath(toPublicPath("KITCHEN", internal))).toBe(internal);
    }
  });

  it("leaves pages a kitchen role can't use alone (they bounce to the dashboard)", () => {
    expect(toPublicPath("KITCHEN", "/admin/inventory")).toBe("/admin/inventory");
    expect(toPublicPath("KITCHEN", "/admin/orders")).toBe("/admin/orders");
  });

  it("does not change other roles", () => {
    expect(toPublicPath("OWNER", "/admin/kitchen")).toBe("/admin/kitchen");
    expect(toPublicPath("MANAGER", "/admin/kitchen")).toBe("/manager/kitchen");
    expect(toPublicPath("DELIVERY", "/admin")).toBe("/rider");
    expect(toInternalPath("/manager/staff")).toBe("/admin/staff");
    expect(toInternalPath("/rider/available")).toBe("/admin/my-deliveries/available");
  });
});
