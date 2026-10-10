import { afterEach, describe, expect, it, vi } from "vitest";
import { canOptimizeImage, menuImageProps } from "@/lib/menu-image";

afterEach(() => vi.unstubAllEnvs());

describe("canOptimizeImage (mirrors next.config.ts remotePatterns)", () => {
  it("allows both Cloudinary cloud names", () => {
    expect(canOptimizeImage("https://res.cloudinary.com/dxohwanal/image/upload/v1/a.webp")).toBe(true);
    expect(canOptimizeImage("https://res.cloudinary.com/dzi3u164c/image/upload/v1/a.webp")).toBe(true);
  });

  it("rejects other Cloudinary accounts and unknown hosts", () => {
    expect(canOptimizeImage("https://res.cloudinary.com/someoneelse/image/upload/a.webp")).toBe(false);
    expect(canOptimizeImage("https://example.com/a.jpg")).toBe(false);
    expect(canOptimizeImage("http://res.cloudinary.com/dxohwanal/a.webp")).toBe(false);
  });

  it("allows the Supabase public storage path only", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    expect(canOptimizeImage("https://abc.supabase.co/storage/v1/object/public/menu/a.jpg")).toBe(true);
    expect(canOptimizeImage("https://abc.supabase.co/rest/v1/a.jpg")).toBe(false);
    expect(canOptimizeImage("https://other.supabase.co/storage/v1/object/public/a.jpg")).toBe(false);
  });

  it("without a Supabase URL configured, Supabase images stay unoptimized", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(canOptimizeImage("https://abc.supabase.co/storage/v1/object/public/menu/a.jpg")).toBe(false);
  });

  it("allows own /public paths, rejects garbage", () => {
    expect(canOptimizeImage("/qr.png")).toBe(true);
    expect(canOptimizeImage("not a url")).toBe(false);
  });

  it("menuImageProps flips the unoptimized flag", () => {
    expect(menuImageProps("https://res.cloudinary.com/dxohwanal/a.webp")).toEqual({ unoptimized: false });
    expect(menuImageProps("https://example.com/a.jpg")).toEqual({ unoptimized: true });
  });
});