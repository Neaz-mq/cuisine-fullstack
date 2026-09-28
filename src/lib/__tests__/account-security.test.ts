import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/resend", () => ({ getResendClient: () => ({}), EMAIL_FROM: "test@example.com" }));

import { passwordMeetsRules, passwordStrength, PASSWORD_RULES } from "@/lib/password-rules";
import { hashLoginCode, makeLoginCode } from "@/lib/login-code";
import { timeAgo } from "@/lib/account";
import { registerSchema } from "@/lib/validations/auth";
import { createStaffSchema } from "@/lib/validations/staff";

/** Change Password: the rules checklist, strength, sign-in codes, "last change". */

describe("password rules", () => {
  it("ticks each Figma rule on its own", () => {
    const met = (pw: string) => PASSWORD_RULES.filter((rule) => rule.test(pw)).map((rule) => rule.id);
    expect(met("abc")).toEqual([]);
    expect(met("abcdefgh")).toEqual(["length"]);
    expect(met("Abcdefgh")).toEqual(["length", "upper"]);
    expect(met("Abcdefg1")).toEqual(["length", "upper", "number"]);
    expect(met("Abc!")).toEqual(["upper", "number"]);
  });

  it("accepts a password only when all rules are met", () => {
    expect(passwordMeetsRules("Abcdefg1")).toBe(true);
    expect(passwordMeetsRules("Abcdef!g")).toBe(true);
    expect(passwordMeetsRules("abcdefg1")).toBe(false);
  });

  it("scores strength from weak to strong", () => {
    expect(passwordStrength("").label).toBe("");
    expect(passwordStrength("abc").label).toBe("Weak");
    expect(passwordStrength("abcdefgh1").label).toBe("Fair");
    expect(passwordStrength("Abcdefg1").label).toBe("Good");
    expect(passwordStrength("Abcdefghijk1!").label).toBe("Strong");
  });
});

describe("sign-in codes", () => {
  it("are always 6 digits", () => {
    for (let i = 0; i < 50; i += 1) expect(makeLoginCode()).toMatch(/^\d{6}$/);
  });

  it("hash differently per user and per code", () => {
    expect(hashLoginCode("u1", "123456")).toBe(hashLoginCode("u1", " 123456 "));
    expect(hashLoginCode("u1", "123456")).not.toBe(hashLoginCode("u2", "123456"));
    expect(hashLoginCode("u1", "123456")).not.toBe(hashLoginCode("u1", "123457"));
    expect(hashLoginCode("u1", "123456")).not.toContain("123456");
  });
});

describe("last password change", () => {
  const now = new Date(2026, 8, 28, 12);
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  it("says it the way people do", () => {
    expect(timeAgo(daysAgo(0), now)).toBe("today");
    expect(timeAgo(daysAgo(1), now)).toBe("yesterday");
    expect(timeAgo(daysAgo(3), now)).toBe("3 days ago");
    expect(timeAgo(daysAgo(14), now)).toBe("2 weeks ago");
    expect(timeAgo(daysAgo(95), now)).toBe("3 months ago");
    expect(timeAgo(daysAgo(800), now)).toBe("2 years ago");
  });
});

describe("one password rule everywhere a password is set", () => {
  const base = { email: "neaz@example.com", phone: "+8801785286930" };
  it("sign up needs 8+ characters, an uppercase letter and a number or symbol", () => {
    expect(registerSchema.safeParse({ ...base, password: "secret1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "secret12" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "Secret12" }).success).toBe(true);
  });

  it("staff accounts follow the same rule", () => {
    const staff = { name: "Rafi", email: "rafi@example.com", role: "CASHIER" };
    expect(createStaffSchema.safeParse({ ...staff, password: "password" }).success).toBe(false);
    expect(createStaffSchema.safeParse({ ...staff, password: "Password1" }).success).toBe(true);
  });
});
