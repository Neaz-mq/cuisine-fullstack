import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/resend", () => ({ getResendClient: () => ({}), EMAIL_FROM: "test@example.com" }));

import { avatarStoragePath, isUploadedAvatar, sniffImageType } from "@/lib/avatar";
import { shouldSendOrderUpdate } from "@/lib/send-order-status-email";

/**
 * Profile Details: the photo upload checks, and who gets "Order Updates"
 * emails.
 */

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => Array.from(text).map((c) => c.charCodeAt(0));

describe("profile photo", () => {
  it("knows a real JPG, PNG or WebP from its first bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))).toBe("image/webp");
  });

  it("refuses anything else, whatever it's called", () => {
    expect(sniffImageType(bytes(...ascii("<svg xmlns")))).toBeNull();
    expect(sniffImageType(bytes(...ascii("<html><scr")))).toBeNull();
    expect(sniffImageType(bytes(...ascii("GIF89a")))).toBeNull();
    expect(sniffImageType(bytes())).toBeNull();
  });

  it("tells an uploaded photo from a Google picture", () => {
    const uploaded = "https://abc.supabase.co/storage/v1/object/public/menu-images/avatars/u1-123.png";
    expect(isUploadedAvatar(uploaded)).toBe(true);
    expect(isUploadedAvatar("https://lh3.googleusercontent.com/a/xyz")).toBe(false);
    expect(isUploadedAvatar("https://abc.supabase.co/storage/v1/object/public/menu-images/dish.png")).toBe(false);
    expect(isUploadedAvatar(null)).toBe(false);
    expect(avatarStoragePath(uploaded)).toBe("avatars/u1-123.png");
    expect(avatarStoragePath(`${uploaded}?v=2`)).toBe("avatars/u1-123.png");
    expect(avatarStoragePath("https://lh3.googleusercontent.com/a/xyz")).toBeNull();
  });
});

describe("order update emails", () => {
  it("emails customers who kept Order Updates on, and guests", () => {
    expect(shouldSendOrderUpdate({ email: "a@b.com", orderType: "DELIVERY", user: { notifyOrderUpdates: true } })).toBe(true);
    expect(shouldSendOrderUpdate({ email: "a@b.com", orderType: "DELIVERY", user: null })).toBe(true);
  });

  it("stays quiet when switched off, for dine-in, or without an email", () => {
    expect(shouldSendOrderUpdate({ email: "a@b.com", orderType: "DELIVERY", user: { notifyOrderUpdates: false } })).toBe(false);
    expect(shouldSendOrderUpdate({ email: "a@b.com", orderType: "DINE_IN", user: null })).toBe(false);
    expect(shouldSendOrderUpdate({ email: null, orderType: "DELIVERY", user: null })).toBe(false);
  });
});
