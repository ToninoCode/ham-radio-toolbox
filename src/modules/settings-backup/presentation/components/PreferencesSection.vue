<script setup lang="ts">
import { computed } from "vue";
import { persistenceMessage, technicalDetail, useI18n } from "@/shared/i18n";
import {
  AppIcon,
  AppNotice,
  SegmentedControl,
  type SegmentedOption,
} from "@/shared/ui";
import type { ThemePreference } from "../../domain/preferences";
import { usePreferencesStore } from "../preferences-store";

const { t } = useI18n();
const preferences = usePreferencesStore();

const themeOptions = computed<SegmentedOption<ThemePreference>[]>(() => [
  { value: "system", label: t("theme.system"), icon: "monitor" },
  { value: "light", label: t("theme.light"), icon: "sun" },
  { value: "dark", label: t("theme.dark"), icon: "moon" },
]);

const theme = computed({
  get: () => preferences.theme,
  set: (value: ThemePreference) => void preferences.setTheme(value),
});
</script>

<template>
  <section
    class="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-5"
    aria-labelledby="preferences-title"
    data-testid="preferences-section"
  >
    <h2
      id="preferences-title"
      class="flex items-center gap-2 text-xl font-semibold"
    >
      <AppIcon name="sliders" :size="22" />
      {{ t("settings.preferences.title") }}
    </h2>

    <SegmentedControl
      v-model="theme"
      :legend="t('settings.preferences.theme')"
      :options="themeOptions"
      data-testid="settings-theme"
    />
    <p class="text-sm text-fg-muted">
      {{ t("settings.preferences.favorites") }}
    </p>

    <div aria-live="polite" class="flex flex-col gap-2">
      <AppNotice
        v-if="preferences.status === 'unavailable' && preferences.loadError"
        tone="warning"
      >
        <p>{{ persistenceMessage(preferences.loadError) }}</p>
        <p class="text-xs text-fg-muted">
          {{ technicalDetail(preferences.loadError) }}
        </p>
      </AppNotice>
      <AppNotice
        v-if="preferences.saveError"
        tone="warning"
        :title="t('settings.preferences.notSaved')"
        data-testid="preferences-not-saved"
      >
        <p>{{ persistenceMessage(preferences.saveError) }}</p>
        <p class="text-xs text-fg-muted">
          {{ technicalDetail(preferences.saveError) }}
        </p>
      </AppNotice>
      <AppNotice v-if="preferences.invalid.length > 0" tone="info">
        {{ t("settings.preferences.invalid") }}
      </AppNotice>
    </div>
  </section>
</template>
