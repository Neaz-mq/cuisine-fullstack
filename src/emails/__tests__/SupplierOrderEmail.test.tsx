import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import SupplierOrderEmail from "@/emails/SupplierOrderEmail";

describe("SupplierOrderEmail", () => {
  const props = {
    supplierName: "Agro Culture",
    orderRef: "PO-ABC123",
    lines: [{ name: "Chicken Breast", quantity: "12 Kg" }],
    note: null,
    acceptUrl: "https://example.com/supplier/orders/abc.def",
    isReminder: false,
    previewText: "preview",
  };

  it("shows the items, the accept link and no prices", async () => {
    const html = await render(SupplierOrderEmail(props));
    expect(html).toContain("Chicken Breast");
    expect(html).toContain("12 Kg");
    expect(html).toContain('href="https://example.com/supplier/orders/abc.def"');
    expect(html).not.toMatch(/cost|price|\$\d/i);
  });

  it("marks a resend as a reminder", async () => {
    const html = await render(SupplierOrderEmail({ ...props, isReminder: true }));
    expect(html).toContain("Reminder");
  });
});
