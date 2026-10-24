import { afterEach, describe, expect, it, vi } from "vitest";
import { settleWithin, STARTUP_PREFERENCES_WAIT_MS } from "./startup";

describe("settleWithin (startup wait for the preferences)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves as soon as the promise settles", async () => {
    await expect(settleWithin(Promise.resolve(), 500)).resolves.toBe("settled");
    await expect(
      settleWithin(Promise.reject(new Error("x")), 500),
    ).resolves.toBe("settled");
  });

  it("gives up after the limit when the database is slow or blocked", async () => {
    vi.useFakeTimers();
    let outcome: string | undefined;
    void settleWithin(
      new Promise(() => undefined),
      STARTUP_PREFERENCES_WAIT_MS,
    ).then((value) => {
      outcome = value;
    });
    await vi.advanceTimersByTimeAsync(STARTUP_PREFERENCES_WAIT_MS - 1);
    expect(outcome).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toBe("timeout");
  });
});
