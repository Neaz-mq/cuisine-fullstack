import { describe, expect, it } from "vitest";
import { describeEmailError, maskEmail } from "@/lib/resend";

describe("describeEmailError", () => {
  it("explains Resend's test-sender restriction", () => {
    const text = describeEmailError({
      statusCode: 403,
      name: "validation_error",
      message: "You can only send testing emails to your own email address (owner@example.com).",
    });
    expect(text).toContain("Verify a domain");
  });
  it("explains an unverified domain", () => {
    expect(describeEmailError({ message: "The cuisine.com domain is not verified." })).toContain("resend.com/domains");
  });
  it("passes other messages through", () => {
    expect(describeEmailError(new Error("socket hang up"))).toBe("socket hang up");
  });
});

describe("maskEmail", () => {
  it("keeps the domain, hides most of the name", () => {
    expect(maskEmail("neazmorshed.tech@gmail.com")).toBe("ne•••@gmail.com");
    expect(maskEmail("bad")).toBe("•••");
  });
});
