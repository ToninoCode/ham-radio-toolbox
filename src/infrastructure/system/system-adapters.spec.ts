// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  DATA_CHANGE_CHANNEL,
  createBroadcastDataChangeNotifier,
} from "./broadcast-data-change-notifier";
import { createNavigatorStorageInfo } from "./navigator-storage-info";

describe("createNavigatorStorageInfo", () => {
  it("reports the browser estimate and the persistence state", async () => {
    const info = createNavigatorStorageInfo({
      estimate: async () => ({ usage: 1024, quota: 4096 }),
      persisted: async () => false,
      persist: async () => true,
    });
    expect(await info.estimate()).toEqual({
      usageBytes: 1024,
      quotaBytes: 4096,
    });
    expect(await info.isPersisted()).toBe(false);
    expect(await info.requestPersistence()).toBe(true);
  });

  it("returns undefined when the API is missing, throws or gives no figures", async () => {
    expect(
      await createNavigatorStorageInfo(undefined).estimate(),
    ).toBeUndefined();
    const failing = createNavigatorStorageInfo({
      estimate: () => Promise.reject(new DOMException("no", "SecurityError")),
      persisted: () => Promise.reject(new TypeError("no")),
    });
    expect(await failing.estimate()).toBeUndefined();
    expect(await failing.isPersisted()).toBeUndefined();
    expect(await failing.requestPersistence()).toBeUndefined();
    const partial = createNavigatorStorageInfo({
      estimate: async () => ({ usage: 10 }),
    });
    expect(await partial.estimate()).toBeUndefined();
  });
});

describe("createBroadcastDataChangeNotifier", () => {
  it("delivers changes to the other tabs, not to the sender", async () => {
    const tabA = createBroadcastDataChangeNotifier();
    const tabB = createBroadcastDataChangeNotifier();
    const seenByA = vi.fn();
    const seenByB = vi.fn();
    tabA.subscribe(seenByA);
    tabB.subscribe(seenByB);

    tabA.publish({ scope: "preferences" });
    await vi.waitFor(() =>
      expect(seenByB).toHaveBeenCalledWith({ scope: "preferences" }),
    );
    expect(seenByA).not.toHaveBeenCalled();
    tabA.close();
    tabB.close();
  });

  it("ignores messages that are not data changes", async () => {
    const tab = createBroadcastDataChangeNotifier();
    const seen = vi.fn();
    tab.subscribe(seen);
    const stranger = new BroadcastChannel(DATA_CHANGE_CHANNEL);
    stranger.postMessage({ scope: "everything" });
    stranger.postMessage("all");
    stranger.postMessage({ scope: "all" });
    await vi.waitFor(() => expect(seen).toHaveBeenCalledWith({ scope: "all" }));
    expect(seen).toHaveBeenCalledTimes(1);
    stranger.close();
    tab.close();
  });

  it("does nothing without BroadcastChannel", () => {
    const notifier = createBroadcastDataChangeNotifier(undefined);
    expect(() => notifier.publish({ scope: "all" })).not.toThrow();
    expect(typeof notifier.subscribe(() => undefined)).toBe("function");
    notifier.close();
  });
});
