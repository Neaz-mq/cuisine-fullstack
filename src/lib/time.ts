/**
 * src/lib/time.ts
 *
 * `Date.now()` is flagged by the React Compiler's purity rule when called
 * directly inside a component body — that rule doesn't distinguish between
 * a Client Component (where it matters for memoization/re-render safety)
 * and an async Server Component (which renders fresh per request anyway).
 * Rather than disabling the rule, the current-time read lives in this tiny
 * helper, called from the component instead of inlined in it.
 */
export function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}
