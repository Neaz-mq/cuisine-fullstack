import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("@/lib/resend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/resend")>();
  return { ...actual, getResendClient: () => ({ emails: { send } }) };
});
vi.mock("@react-email/render", () => ({
  render: async (_node: unknown, options?: { plainText?: boolean }) => (options?.plainText ? "text" : "<p>html</p>"),
}));

import { isRetryableEmailError, sendEmail } from "@/lib/send-email";

const input = { to: "mumu@gmail.com", subject: "Hi", react: {} as never, tag: "test", idempotencyKey: "k1" };

describe("sendEmail", () => {
  beforeEach(() => {
    send.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("sends HTML and plain text with the idempotency key", async () => {
    send.mockResolvedValue({ data: { id: "e1" }, error: null });
    await expect(sendEmail(input)).resolves.toEqual({ ok: true, id: "e1" });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ html: "<p>html</p>", text: "text" }), { idempotencyKey: "k1" });
  });

  it("treats a returned Resend error as a failure (it doesn't throw)", async () => {
    send.mockResolvedValue({ data: null, error: { name: "validation_error", statusCode: 403, message: "You can only send testing emails to your own email address" } });
    const result = await sendEmail(input);
    expect(result.ok).toBe(false);
    expect(send).toHaveBeenCalledTimes(1); // permanent — no retry
  });

  it("retries a rate limit and then succeeds", async () => {
    vi.useFakeTimers();
    send
      .mockResolvedValueOnce({ data: null, error: { name: "rate_limit_exceeded", statusCode: 429, message: "Too many requests" } })
      .mockResolvedValueOnce({ data: { id: "e2" }, error: null });
    const pending = sendEmail(input);
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ ok: true, id: "e2" });
    expect(send).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("never throws, even when the client does", async () => {
    vi.useFakeTimers();
    send.mockRejectedValue(new Error("socket hang up"));
    const pending = sendEmail(input);
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ ok: false, reason: "socket hang up" });
    expect(send).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

describe("isRetryableEmailError", () => {
  it("retries only problems that pass on their own", () => {
    expect(isRetryableEmailError({ name: "rate_limit_exceeded", statusCode: 429 })).toBe(true);
    expect(isRetryableEmailError({ name: "internal_server_error", statusCode: 500 })).toBe(true);
    expect(isRetryableEmailError({ name: "daily_quota_exceeded", statusCode: 429 })).toBe(false);
    expect(isRetryableEmailError({ name: "validation_error", statusCode: 403 })).toBe(false);
    expect(isRetryableEmailError({ name: "invalid_from_address", statusCode: 422 })).toBe(false);
  });
});
