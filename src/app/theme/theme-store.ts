import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { usePreferencesStore } from "@/modules/settings-backup";
import {
  applyTheme,
  DARK_QUERY,
  resolveTheme,
  type ThemePreference,
} from "./theme";

/**
 * Theme (FR-DSH-06): the preference (system, light, dark) is persisted in
 * `settings` by the preferences store of settings-backup, the only source
 * of truth; this store resolves it against the system scheme and applies
 * it to the document. main.ts waits briefly for the stored preference
 * before mounting, so the page does not switch theme after it appears.
 */
export const useThemeStore = defineStore("theme", () => {
  const preferences = usePreferencesStore();
  const preference = computed<ThemePreference>(() => preferences.theme);
  const systemPrefersDark = ref(false);
  const resolved = computed(() =>
    resolveTheme(preference.value, systemPrefersDark.value),
  );

  let started = false;

  /** Binds the system preference and applies the theme to the document. */
  function start(): void {
    if (started) return;
    started = true;

    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia(DARK_QUERY)
        : undefined;
    systemPrefersDark.value = media?.matches ?? false;
    media?.addEventListener("change", (event) => {
      systemPrefersDark.value = event.matches;
    });

    watch(resolved, (theme) => applyTheme(document, theme), {
      immediate: true,
    });
  }

  function setPreference(value: ThemePreference): void {
    void preferences.setTheme(value);
  }

  return { preference, resolved, start, setPreference };
});
