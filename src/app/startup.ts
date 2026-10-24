/**
 * Longest wait for the stored preferences before mounting (ADR-0016).
 * Reading them usually takes a few milliseconds; waiting avoids a theme
 * switch and a favourites list that pops in after the page appears. If the
 * database is slow or blocked by another tab, the app mounts with the
 * defaults and applies the stored values when they arrive, without
 * overwriting what the user changed meanwhile (preferences store).
 */
export const STARTUP_PREFERENCES_WAIT_MS = 500;

/** Resolves when `promise` settles or after `ms`, whichever comes first. */
export function settleWithin(
  promise: Promise<unknown>,
  ms: number,
): Promise<"settled" | "timeout"> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("timeout"), ms);
    void promise
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timer);
        resolve("settled");
      });
  });
}
