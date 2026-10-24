import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";
import type { PersistenceError } from "@/shared/application";
import type { Result } from "@/shared/types";
import type { PreferenceKey } from "../application/preferences-service";
import type { ThemePreference } from "../domain/preferences";
import { useSettingsServices } from "./services";

/**
 * - `loading`: first read in progress (defaults shown meanwhile);
 * - `ready`: values read from the database;
 * - `unavailable`: the database cannot be read; changes live in memory.
 */
export type PreferencesStatus = "loading" | "ready" | "unavailable";

type Field = "theme" | "favorites";

/**
 * Preferences of the app (FR-SET-02, FR-DSH-03/06): theme and favourite
 * modules, persisted in `settings` through the preferences use cases. The
 * database is the only source of truth; this store holds what the UI
 * shows. Changes apply at once and are written in order; when a write
 * fails the value stays in memory and `saveError` says it is not saved.
 * Changes committed by other tabs reload the values.
 */
export const usePreferencesStore = defineStore("preferences", () => {
  const services = useSettingsServices();

  const theme = ref<ThemePreference>("system");
  const favorites = ref<string[]>([]);
  const status = ref<PreferencesStatus>("loading");
  const loadError = shallowRef<PersistenceError>();
  const saveError = shallowRef<PersistenceError>();
  const invalid = ref<PreferenceKey[]>([]);

  /** Local changes not yet written, and changes made during a load. */
  const pending: Record<Field, number> = { theme: 0, favorites: 0 };
  const changedDuringLoad: Record<Field, boolean> = {
    theme: false,
    favorites: false,
  };
  let loading: Promise<void> | undefined;
  let writes: Promise<unknown> = Promise.resolve();

  const keep = (field: Field) => pending[field] > 0 || changedDuringLoad[field];

  /** Reads the stored values; local changes not yet written are kept. */
  function load(): Promise<void> {
    loading ??= (async () => {
      changedDuringLoad.theme = false;
      changedDuringLoad.favorites = false;
      const result = await services.preferences.load();
      if (result.ok) {
        const { preferences } = result.value;
        if (!keep("theme")) theme.value = preferences.theme;
        if (!keep("favorites")) favorites.value = [...preferences.favorites];
        invalid.value = [...result.value.invalid];
        loadError.value = undefined;
        status.value = "ready";
      } else {
        loadError.value = result.error;
        if (status.value !== "ready") status.value = "unavailable";
      }
    })().finally(() => {
      loading = undefined;
    });
    return loading;
  }

  function persist(
    field: Field,
    write: () => Promise<Result<unknown, PersistenceError>>,
  ): Promise<void> {
    pending[field]++;
    changedDuringLoad[field] = true;
    const run = writes
      .then(write)
      .then((result) => {
        saveError.value = result.ok ? undefined : result.error;
        if (result.ok) {
          invalid.value = invalid.value.filter(
            (key) => key !== (field === "theme" ? "app" : "dashboard"),
          );
        }
      })
      .finally(() => {
        pending[field]--;
      });
    writes = run.catch(() => undefined);
    return run;
  }

  function setTheme(value: ThemePreference): Promise<void> {
    theme.value = value;
    return persist("theme", () => services.preferences.saveTheme(value));
  }

  function setFavorites(value: readonly string[]): Promise<void> {
    const list = [...value];
    favorites.value = list;
    return persist("favorites", () => services.preferences.saveFavorites(list));
  }

  function toggleFavorite(id: string): Promise<void> {
    return setFavorites(
      favorites.value.includes(id)
        ? favorites.value.filter((favorite) => favorite !== id)
        : [...favorites.value, id],
    );
  }

  services.dataChanges.subscribe((change) => {
    if (change.scope === "preferences" || change.scope === "all") void load();
  });

  return {
    theme,
    favorites,
    status,
    loadError,
    saveError,
    invalid,
    load,
    setTheme,
    setFavorites,
    toggleFavorite,
  };
});
