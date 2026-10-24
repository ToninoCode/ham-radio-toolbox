import type {
  DataChangeNotifier,
  PersistenceError,
} from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";
import {
  APP_PREFERENCES,
  DASHBOARD_PREFERENCES,
  type ThemePreference,
} from "../domain/preferences";
import type { SettingDefinition } from "../domain/setting";
import type { SettingsRepository } from "./ports";

/** Preferences used by the app shell (theme) and the dashboard (favourites). */
export interface Preferences {
  readonly theme: ThemePreference;
  readonly favorites: readonly string[];
}

/** Keys of `settings` read by {@link PreferencesService.load}. */
export type PreferenceKey = "app" | "dashboard";

export interface LoadedPreferences {
  readonly preferences: Preferences;
  /**
   * Keys whose stored value fails its schema (e.g. written by a newer app
   * version): their defaults are in use and the next change replaces them.
   */
  readonly invalid: readonly PreferenceKey[];
}

/**
 * Use cases of the preferences (FR-SET-02, FR-DSH-03/06). Values are
 * validated with the schema of their key before every write; failures of
 * the storage are returned, never hidden.
 */
export interface PreferencesService {
  /** Reads every preference; `err` only when the storage cannot be read. */
  load(): Promise<Result<LoadedPreferences, PersistenceError>>;
  saveTheme(
    theme: ThemePreference,
  ): Promise<Result<ThemePreference, PersistenceError>>;
  /** Favourite module ids, in pinning order. */
  saveFavorites(
    favorites: readonly string[],
  ): Promise<Result<readonly string[], PersistenceError>>;
}

export interface PreferencesServiceDeps {
  readonly settings: SettingsRepository;
  readonly notifier: DataChangeNotifier;
}

export function createPreferencesService(
  deps: PreferencesServiceDeps,
): PreferencesService {
  const { settings, notifier } = deps;

  /** Stored value or default; `invalid` when the stored value is unusable. */
  async function readOrDefault<T>(
    setting: SettingDefinition<T>,
  ): Promise<Result<{ value: T; invalid: boolean }, PersistenceError>> {
    const read = await settings.read(setting);
    if (read.ok) return ok({ value: read.value, invalid: false });
    if (read.error.code === "persistence.invalid-input") {
      return ok({ value: setting.defaultValue, invalid: true });
    }
    return err(read.error);
  }

  async function write<T>(
    setting: SettingDefinition<T>,
    value: T,
  ): Promise<Result<T, PersistenceError>> {
    const written = await settings.write(setting, value);
    if (written.ok) notifier.publish({ scope: "preferences" });
    return written;
  }

  return {
    async load() {
      const app = await readOrDefault(APP_PREFERENCES);
      if (!app.ok) return app;
      const dashboard = await readOrDefault(DASHBOARD_PREFERENCES);
      if (!dashboard.ok) return dashboard;
      const invalid: PreferenceKey[] = [];
      if (app.value.invalid) invalid.push("app");
      if (dashboard.value.invalid) invalid.push("dashboard");
      return ok({
        preferences: {
          theme: app.value.value.theme,
          favorites: dashboard.value.value.favorites,
        },
        invalid,
      });
    },

    async saveTheme(theme) {
      // `app` holds only the theme today; a key that gains fields must
      // read and merge before writing.
      const written = await write(APP_PREFERENCES, { theme });
      return written.ok ? ok(written.value.theme) : written;
    },

    async saveFavorites(favorites) {
      const written = await write(DASHBOARD_PREFERENCES, {
        favorites: [...favorites],
      });
      return written.ok ? ok(written.value.favorites) : written;
    },
  };
}
