import { describe, it, expect } from "vitest";
import {
  panelViewForPath,
  panelViewFromReferer,
  publicPrefixForRole,
  toInternalPath,
  toPublicPath,
} from "@/lib/panel-url";

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
    // Settings is the kitchen's own page — not the owner-only /admin/settings.
    expect(toInternalPath("/kitchen/settings")).toBe("/admin/kitchen/settings");
  });

  it("maps internal → public", () => {
    expect(toPublicPath("KITCHEN", "/admin")).toBe("/kitchen");
    expect(toPublicPath("KITCHEN", "/admin/kitchen")).toBe("/kitchen/live-orders");
    expect(toPublicPath("KITCHEN", "/admin/kitchen/prep")).toBe("/kitchen/prep");
    expect(toPublicPath("KITCHEN", "/admin/kitchen/inventory")).toBe("/kitchen/inventory");
    expect(toPublicPath("KITCHEN", "/admin/profile")).toBe("/kitchen/profile");
    expect(toPublicPath("KITCHEN", "/admin/kitchen/settings")).toBe("/kitchen/settings");
  });

  it("round-trips every kitchen page", () => {
    for (const internal of ["/admin", "/admin/kitchen", "/admin/kitchen/prep", "/admin/kitchen/inventory", "/admin/kitchen/settings", "/admin/profile"]) {
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

describe("OWNER viewing the Kitchen / Manager panel", () => {
  it("knows which panel a public path belongs to", () => {
    expect(panelViewForPath("/kitchen")).toBe("KITCHEN");
    expect(panelViewForPath("/kitchen/prep")).toBe("KITCHEN");
    expect(panelViewForPath("/manager")).toBe("MANAGER");
    expect(panelViewForPath("/manager/orders")).toBe("MANAGER");
    expect(panelViewForPath("/admin/kitchen")).toBeNull();
    expect(panelViewForPath("/kitchenette")).toBeNull();
    expect(panelViewForPath("/rider")).toBeNull();
  });

  it("owner keeps plain /admin addresses", () => {
    expect(publicPrefixForRole("OWNER")).toBeNull();
    expect(toPublicPath("OWNER", "/admin/kitchen")).toBe("/admin/kitchen");
  });

  it("reads the panel from a same-site Referer only", () => {
    expect(panelViewFromReferer("http://localhost:3000/kitchen/prep", "localhost:3000")).toBe("KITCHEN");
    expect(panelViewFromReferer("http://localhost:3000/manager/orders?x=1", "localhost:3000")).toBe("MANAGER");
    expect(panelViewFromReferer("http://localhost:3000/admin/orders", "localhost:3000")).toBeNull();
    expect(panelViewFromReferer("https://evil.example/kitchen", "localhost:3000")).toBeNull();
    expect(panelViewFromReferer(null, "localhost:3000")).toBeNull();
    expect(panelViewFromReferer("not a url", "localhost:3000")).toBeNull();
  });

  it("maps an /admin link clicked inside a panel back into that panel", () => {
    expect(toPublicPath("KITCHEN", "/admin")).toBe("/kitchen");
    expect(toPublicPath("KITCHEN", "/admin/kitchen")).toBe("/kitchen/live-orders");
    expect(toPublicPath("KITCHEN", "/admin/kitchen/prep")).toBe("/kitchen/prep");
    expect(toPublicPath("KITCHEN", "/admin/profile")).toBe("/kitchen/profile");
    expect(toPublicPath("MANAGER", "/admin")).toBe("/manager");
    expect(toPublicPath("MANAGER", "/admin/orders")).toBe("/manager/orders");
    expect(toPublicPath("MANAGER", "/admin/staff")).toBe("/manager/staff");
  });
});