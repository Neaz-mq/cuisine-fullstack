/**
 * src/lib/locate-device.ts — checkout's "Use current location".
 */

/** Up to this it's a real GPS fix; above it, ask the customer to check the street. */
export const GOOD_LOCATION_ACCURACY_M = 150;

/** 1 = permission denied, 2 = position unavailable, 3 = timeout (same as the browser's codes). */
export type LocateError = { code: 1 | 2 | 3 };

/**
 * The phone's position — the way food-delivery apps get it.
 *
 * ⚠️ Not a single `getCurrentPosition({ enableHighAccuracy, timeout: 15s })`
 * any more. Indoors, a phone's first GPS fix often takes longer than that,
 * and the customer got "took too long" even with location switched on.
 *
 * Now:
 *   1. Watch the position with GPS. The first reading usually comes in a
 *      second or two from Wi-Fi / mobile network; better ones follow.
 *   2. As soon as one is accurate to 150 m, use it. Otherwise give it a
 *      few more seconds to improve, then use the best one so far.
 *   3. No GPS reading at all (deep indoors) → ask once more for the quick
 *      network position, which doesn't need GPS.
 *
 * The browser's own timeout only starts after the customer taps Allow,
 * so the time spent reading the permission prompt isn't counted against
 * them. A last 45-second guard makes sure "Locating…" can never hang.
 */
export const GPS_WAIT_MS = 20_000;
export const SETTLE_MS = 6_000;
export const LOCATE_GUARD_MS = 45_000;

export function locateDevice(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    const geo = navigator.geolocation;
    let best: GeolocationPosition | null = null;
    let settled = false;
    let watchId: number | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const stopWatching = () => {
      if (watchId !== null) geo.clearWatch(watchId);
      watchId = null;
      clearTimeout(settleTimer);
      clearTimeout(guard);
    };
    const succeed = (position: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      stopWatching();
      resolve(position);
    };
    const fail = (error: LocateError) => {
      if (settled) return;
      settled = true;
      stopWatching();
      reject(error);
    };
    const networkFallback = () => {
      stopWatching();
      geo.getCurrentPosition(succeed, (error) => fail({ code: error.code as LocateError["code"] }), {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 5 * 60_000,
      });
    };

    const guard = setTimeout(() => (best ? succeed(best) : fail({ code: 3 })), LOCATE_GUARD_MS);

    watchId = geo.watchPosition(
      (position) => {
        if (!best || position.coords.accuracy < best.coords.accuracy) best = position;
        if (position.coords.accuracy <= GOOD_LOCATION_ACCURACY_M) {
          succeed(position);
        } else if (!settleTimer) {
          settleTimer = setTimeout(() => best && succeed(best), SETTLE_MS);
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) return fail({ code: 1 });
        if (best) return succeed(best);
        networkFallback();
      },
      { enableHighAccuracy: true, timeout: GPS_WAIT_MS, maximumAge: 30_000 }
    );
  });
}
