import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { useOnline } from "./use-online";
import { useUtcClock } from "./use-utc-clock";

function setNavigatorOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

describe("useOnline", () => {
  it("follows navigator.onLine and the online/offline events", () => {
    setNavigatorOnline(true);
    const scope = effectScope();
    const online = scope.run(() => useOnline())!;
    expect(online.value).toBe(true);

    setNavigatorOnline(false);
    window.dispatchEvent(new Event("offline"));
    expect(online.value).toBe(false);

    setNavigatorOnline(true);
    window.dispatchEvent(new Event("online"));
    expect(online.value).toBe(true);

    scope.stop();
  });

  it("removes its listeners when the scope is disposed", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const scope = effectScope();
    scope.run(() => useOnline());
    scope.stop();
    expect(remove).toHaveBeenCalledWith("online", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("offline", expect.any(Function));
  });
});

describe("useUtcClock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks on second boundaries and stops when disposed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T13:21:05.400Z"));
    const scope = effectScope();
    const now = scope.run(() => useUtcClock())!;
    expect(now.value.toISOString()).toBe("2026-10-17T13:21:05.400Z");

    vi.advanceTimersByTime(600);
    expect(now.value.toISOString()).toBe("2026-10-17T13:21:06.000Z");

    vi.advanceTimersByTime(1000);
    expect(now.value.toISOString()).toBe("2026-10-17T13:21:07.000Z");

    scope.stop();
    vi.advanceTimersByTime(5000);
    expect(now.value.toISOString()).toBe("2026-10-17T13:21:07.000Z");
  });
});
