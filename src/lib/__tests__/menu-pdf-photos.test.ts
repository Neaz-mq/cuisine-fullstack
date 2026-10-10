import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { allowedPhotoHosts, cloudinaryJpg, fetchMenuPhoto } from "@/lib/menu-pdf-photos";

// sharp দিয়ে ছবি বানানো/পড়া CPU-ভারী; ধীর CI-তে ডিফল্ট ৫s যথেষ্ট নাও হতে পারে।
vi.setConfig({ testTimeout: 20_000 });

const env = { NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co" } as unknown as NodeJS.ProcessEnv;

const image = (format: "png" | "webp" | "jpeg", w = 900, h = 500) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 255, g: 148, b: 64 } } })
    [format]()
    .toBuffer();

const reply = (body: Buffer | string, init: ResponseInit = {}) =>
  vi.fn(async () => new Response(body as BodyInit, { status: 200, ...init })) as unknown as typeof fetch;

describe("allowedPhotoHosts", () => {
  it("always allows Cloudinary and adds the Supabase host from env", () => {
    expect([...allowedPhotoHosts(env)].sort()).toEqual(["proj.supabase.co", "res.cloudinary.com"]);
    expect([...allowedPhotoHosts({} as NodeJS.ProcessEnv)]).toEqual(["res.cloudinary.com"]);
  });

  it("ignores a malformed Supabase URL instead of throwing", () => {
    expect([...allowedPhotoHosts({ NEXT_PUBLIC_SUPABASE_URL: "not a url" } as unknown as NodeJS.ProcessEnv)]).toEqual([
      "res.cloudinary.com",
    ]);
  });
});

describe("cloudinaryJpg", () => {
  it("inserts a square-crop JPEG transformation after /image/upload/", () => {
    expect(cloudinaryJpg("https://res.cloudinary.com/abc/image/upload/v1/food/a.webp")).toBe(
      "https://res.cloudinary.com/abc/image/upload/c_fill,g_auto,w_640,h_640,f_jpg,q_80/v1/food/a.webp"
    );
  });

  it("leaves non-Cloudinary URLs untouched", () => {
    const u = "https://proj.supabase.co/storage/v1/object/public/x.png";
    expect(cloudinaryJpg(u)).toBe(u);
  });
});

describe("fetchMenuPhoto", () => {
  it.each(["png", "webp", "jpeg"] as const)("turns a %s into a 640px JPEG", async (format) => {
    const out = await fetchMenuPhoto("https://proj.supabase.co/x." + format, {
      env,
      fetchImpl: reply(await image(format)),
    });
    expect(out).not.toBeNull();
    expect([out![0], out![1]]).toEqual([0xff, 0xd8]); // JPEG magic
    const meta = await sharp(Buffer.from(out!)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 640, 640]);
  });

  it("refuses unknown hosts and non-https URLs without making any request", async () => {
    const fetchImpl = reply("x");
    expect(await fetchMenuPhoto("https://evil.example.com/a.jpg", { env, fetchImpl })).toBeNull();
    expect(await fetchMenuPhoto("http://res.cloudinary.com/a.jpg", { env, fetchImpl })).toBeNull();
    expect(await fetchMenuPhoto("http://169.254.169.254/latest/meta-data", { env, fetchImpl })).toBeNull();
    expect(await fetchMenuPhoto("not a url", { env, fetchImpl })).toBeNull();
    expect(await fetchMenuPhoto(null, { env, fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns null (never throws) on 404, network error, corrupt bytes and oversized files", async () => {
    const url = "https://res.cloudinary.com/abc/image/upload/v1/a.jpg";
    expect(await fetchMenuPhoto(url, { env, fetchImpl: reply("nope", { status: 404 }) })).toBeNull();
    expect(
      await fetchMenuPhoto(url, { env, fetchImpl: (async () => Promise.reject(new Error("boom"))) as typeof fetch })
    ).toBeNull();
    expect(await fetchMenuPhoto(url, { env, fetchImpl: reply("this is not an image") })).toBeNull();
    expect(
      await fetchMenuPhoto(url, { env, fetchImpl: reply("x", { headers: { "content-length": String(50 * 1024 * 1024) } }) })
    ).toBeNull();
  });

  it("asks fetch not to follow redirects (SSRF guard)", async () => {
    const fetchImpl = reply(await image("jpeg"));
    await fetchMenuPhoto("https://proj.supabase.co/a.jpg", { env, fetchImpl });
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(init.redirect).toBe("error");
  });
});
