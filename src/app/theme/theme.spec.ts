import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import type { AppContainer } from "@/app/container";
import {
  APP_PREFERENCES,
  usePreferencesStore,
} from "@/modules/settings-backup";
import { createStoreTestApp } from "../../../tests/support/app-services";
import { expectOk } from "../../../tests/support/records";
import { applyTheme, resolveTheme, THEME_COLORS } from "./theme";
import { useThemeStore } from "./theme-store";

type ChangeListener = (event: { matches: boolean }) => void;

/** Minimal `matchMedia` stub whose system preference can be changed. */
function stubMatchMedia(initiallyDark: boolean) {
  const listeners: ChangeListener[] = [];
  const media = {
    matches: initiallyDark,
    addEventListener: (_type: "change", listener: ChangeListener) => {
      listeners.push(listener);
    },
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  return {
    setSystemDark(dark: boolean) {
      media.matches = dark;
      listeners.forEach((listener) => listener({ matches: dark }));
    },
  };
}

function resetDocument() {
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  document.head.innerHTML = '<meta name="theme-color" content="#000000" />';
}

describe("resolveTheme", () => {
  it.each([
    ["system", false, "light"],
    ["system", true, "dark"],
    ["light", true, "light"],
    ["dark", false, "dark"],
  ] as const)("%s with system dark=%s → %s", (preference, dark, expected) => {
    expect(resolveTheme(preference, dark)).toBe(expected);
  });
});

describe("applyTheme", () => {
  beforeEach(resetDocument);

  it("sets the class, color-scheme and theme-color of the document", () => {
    applyTheme(document, "dark");
    const root = document.documentElement;
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.classList.contains("light")).toBe(false);
    expect(root.style.colorScheme).toBe("dark");
    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content"),
    ).toBe(THEME_COLORS.dark);

    applyTheme(document, "light");
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.classList.contains("light")).toBe(true);
  });
});

describe("theme store", () => {
  let container: AppContainer;

  beforeEach(() => {
    resetDocument();
    container = createStoreTestApp().container;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows the system preference by default", async () => {
    const system = stubMatchMedia(true);
    const store = useThemeStore();
    store.start();

    expect(store.preference).toBe("system");
    expect(store.resolved).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    system.setSystemDark(false);
    await nextTick();
    expect(store.resolved).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("applies a manual override regardless of the system preference", async () => {
    const system = stubMatchMedia(true);
    const store = useThemeStore();
    store.start();

    store.setPreference("light");
    await nextTick();
    expect(document.documentElement.classList.contains("light")).toBe(true);

    system.setSystemDark(true);
    await nextTick();
    expect(store.resolved).toBe("light");

    store.setPreference("system");
    await nextTick();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("persists the preference in settings and reads it back (FR-DSH-06)", async () => {
    stubMatchMedia(false);
    const store = useThemeStore();
    store.start();
    store.setPreference("dark");
    await vi.waitFor(async () =>
      expect(
        expectOk(await container.repositories.settings.read(APP_PREFERENCES)),
      ).toEqual({ theme: "dark" }),
    );

    // A new session (new Pinia) on the same database starts from "dark".
    resetDocument();
    createStoreTestApp(container);
    await usePreferencesStore().load();
    const next = useThemeStore();
    next.start();
    expect(next.preference).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("falls back to light when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const store = useThemeStore();
    store.start();
    expect(store.resolved).toBe("light");
  });
});
