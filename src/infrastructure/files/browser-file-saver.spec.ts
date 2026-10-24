import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DOWNLOAD_URL_LIFETIME_MS,
  createBrowserFileSaver,
} from "./browser-file-saver";

describe("createBrowserFileSaver", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("downloads through a temporary blob URL, revoked later", () => {
    vi.useFakeTimers();
    const created: string[] = [];
    const revoked: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      created.push("blob:test/1");
      return "blob:test/1";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
      revoked.push(url);
    });
    const clicks: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push({ href: this.href, download: this.download });
    });

    const result = createBrowserFileSaver().save({
      blob: new Blob(["{}"]),
      fileName: "hrt-backup-20261024-1300Z.json",
    });
    expect(result.ok).toBe(true);
    expect(clicks).toEqual([
      { href: "blob:test/1", download: "hrt-backup-20261024-1300Z.json" },
    ]);
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revoked).toEqual([]);
    vi.advanceTimersByTime(DOWNLOAD_URL_LIFETIME_MS);
    expect(revoked).toEqual(created);
  });

  it("reports a failure without throwing", () => {
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(
      createBrowserFileSaver().save({ blob: new Blob([]), fileName: "x.json" }),
    ).toEqual({
      ok: false,
      error: { code: "file.save-failed", cause: "SecurityError" },
    });
  });
});
