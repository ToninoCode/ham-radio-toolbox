<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/shared/i18n";
import { SegmentedControl, type SegmentedOption } from "@/shared/ui";
import type { ThemePreference } from "../theme/theme";
import { useThemeStore } from "../theme/theme-store";

withDefaults(defineProps<{ iconOnly?: boolean }>(), { iconOnly: true });

const { t } = useI18n();
const theme = useThemeStore();

const options = computed<SegmentedOption<ThemePreference>[]>(() => [
  { value: "system", label: t("theme.system"), icon: "monitor" },
  { value: "light", label: t("theme.light"), icon: "sun" },
  { value: "dark", label: t("theme.dark"), icon: "moon" },
]);

const preference = computed({
  get: () => theme.preference,
  set: (value: ThemePreference) => theme.setPreference(value),
});
</script>

<template>
  <SegmentedControl
    v-model="preference"
    :legend="t('theme.label')"
    :options="options"
    :hide-legend="iconOnly"
    :icon-only="iconOnly"
    data-testid="theme-selector"
  />
</template>
