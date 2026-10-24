import { describe, expect, it } from "vitest";
import {
  createStoreTestApp,
  createTestContainer,
} from "../../../../tests/support/app-services";
import { expectOk } from "../../../../tests/support/records";
import type { LoadedPreferences } from "../application/preferences-service";
import { APP_PREFERENCES, DASHBOARD_PREFERENCES } from "../domain/preferences";
import type { Result } from "@/shared/types";
import type { PersistenceError } from "@/shared/application";
import { usePreferencesStore } from "./preferences-store";

/** A preferences load held until `release()`: a database slower than 500 ms. */
function slowLoad(value: LoadedPreferences) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    release,
    load: async (): Promise<Result<LoadedPreferences, PersistenceError>> => {
      await gate;
      return { ok: true, value };
    },
  };
}

const STORED: LoadedPreferences = {
  preferences: { theme: "dark", favorites: ["propagation"] },
  invalid: [],
};

describe("preferences store: a load that ends after the startup wait", () => {
  it("never overwrites the choices made by the user meanwhile", async () => {
    const container = createTestContainer();
    const slow = slowLoad(STORED);
    createStoreTestApp(container, {
      preferences: { ...container.services.preferences, load: slow.load },
    });
    const store = usePreferencesStore();
    const loading = store.load();
    expect(store.status).toBe("loading");

    // The app mounted with the defaults; the user changes both preferences.
    await store.setTheme("light");
    await store.toggleFavorite("rf-calculators");

    slow.release();
    await loading;
    expect(store.status).toBe("ready");
    expect(store.theme).toBe("light");
    expect(store.favorites).toEqual(["rf-calculators"]);
    // What is stored is the user's choice, not the late value.
    expect(
      expectOk(await container.repositories.settings.read(APP_PREFERENCES)),
    ).toEqual({ theme: "light" });
    expect(
      expectOk(
        await container.repositories.settings.read(DASHBOARD_PREFERENCES),
      ),
    ).toEqual({ favorites: ["rf-calculators"] });
  });

  it("keeps a change still being written when the load returns", async () => {
    const container = createTestContainer();
    const slow = slowLoad(STORED);
    createStoreTestApp(container, {
      preferences: { ...container.services.preferences, load: slow.load },
    });
    const store = usePreferencesStore();
    const loading = store.load();
    const writing = store.setTheme("light"); // not awaited: still pending
    slow.release();
    await loading;
    expect(store.theme).toBe("light");
    await writing;
    expect(store.theme).toBe("light");
  });

  it("applies the late value to the preferences the user did not touch", async () => {
    const container = createTestContainer();
    const slow = slowLoad(STORED);
    createStoreTestApp(container, {
      preferences: { ...container.services.preferences, load: slow.load },
    });
    const store = usePreferencesStore();
    const loading = store.load();
    await store.setTheme("light");
    slow.release();
    await loading;
    expect(store.theme).toBe("light");
    expect(store.favorites).toEqual(["propagation"]);
  });

  it("a later reload (another tab, restore) takes the stored values again", async () => {
    const container = createTestContainer();
    createStoreTestApp(container);
    const store = usePreferencesStore();
    await store.load();
    await store.setTheme("light");
    expectOk(
      await container.repositories.settings.write(APP_PREFERENCES, {
        theme: "dark",
      }),
    );
    await store.load();
    expect(store.theme).toBe("dark");
  });
});
