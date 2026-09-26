import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GPS_WAIT_MS, SETTLE_MS, locateDevice } from "@/lib/locate-device";

/**
 * "Use current location" on a phone: GPS if it comes, the quick
 * Wi-Fi / mobile-network position if it doesn't — never a dead end
 * just because the first GPS fix is slow indoors.
 */

type Success = (p: GeolocationPosition) => void;
type Failure = (e: GeolocationPositionError) => void;

const pos = (accuracy: number) =>
  ({ coords: { latitude: 24.85, longitude: 89.37, accuracy }, timestamp: Date.now() }) as GeolocationPosition;
const err = (code: number) =>
  ({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "" }) as GeolocationPositionError;

let watch: { ok: Success; fail: Failure } | null;
let single: { ok: Success; fail: Failure; options?: PositionOptions } | null;
const clearWatch = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  watch = null;
  single = null;
  clearWatch.mockReset();
  vi.stubGlobal("navigator", {
    geolocation: {
      watchPosition: (ok: Success, fail: Failure) => {
        watch = { ok, fail };
        return 7;
      },
      clearWatch,
      getCurrentPosition: (ok: Success, fail: Failure, options?: PositionOptions) => {
        single = { ok, fail, options };
      },
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("locateDevice", () => {
  it("uses an accurate GPS reading straight away", async () => {
    const result = locateDevice();
    watch!.ok(pos(20));
    await expect(result).resolves.toMatchObject({ coords: { accuracy: 20 } });
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it("waits a little for a better reading, then takes the best one", async () => {
    const result = locateDevice();
    watch!.ok(pos(900));
    watch!.ok(pos(400));
    vi.advanceTimersByTime(SETTLE_MS);
    await expect(result).resolves.toMatchObject({ coords: { accuracy: 400 } });
  });

  it("falls back to the network position when GPS times out indoors", async () => {
    const result = locateDevice();
    watch!.fail(err(3));
    expect(single?.options?.enableHighAccuracy).toBe(false);
    single!.ok(pos(60));
    await expect(result).resolves.toMatchObject({ coords: { accuracy: 60 } });
  });

  it("reports a blocked permission without retrying", async () => {
    const result = locateDevice();
    watch!.fail(err(1));
    await expect(result).rejects.toEqual({ code: 1 });
    expect(single).toBeNull();
  });

  it("never hangs: gives up after the guard time", async () => {
    const result = locateDevice();
    vi.advanceTimersByTime(GPS_WAIT_MS + 30_000);
    await expect(result).rejects.toEqual({ code: 3 });
  });
});
