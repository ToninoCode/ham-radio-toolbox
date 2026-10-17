import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import {
  applyTheme,
  DARK_QUERY,
  resolveTheme,
  type ThemePreference,
} from "./theme";

/**
 * Theme preference (FR-DSH-06): system, light or dark.
 *
 * TODO(M2): persist the preference in the `settings` table through the
 * settings use cases. Until then it lives in memory and starts from
 * "system", which also avoids a wrong-theme flash at startup.
 */
export const useThemeStore = defineStore("theme", () => {
  const preference = ref<ThemePreference>("system");
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
    preference.value = value;
  }

  return { preference, resolved, start, setPreference };
});
