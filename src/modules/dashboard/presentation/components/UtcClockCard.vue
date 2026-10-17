<script setup lang="ts">
import { useUtcClock } from "@/shared/composables";
import {
  formatUtcDate,
  formatUtcTime,
  toIsoUtcSeconds,
  useI18n,
} from "@/shared/i18n";
import { AppIcon } from "@/shared/ui";

const { t } = useI18n();
const now = useUtcClock();
</script>

<template>
  <section
    class="flex flex-col gap-2 rounded-card border border-border bg-surface p-5"
    aria-labelledby="dashboard-clock-title"
    data-testid="utc-clock-card"
  >
    <h2
      id="dashboard-clock-title"
      class="flex items-center gap-2 font-semibold"
    >
      <AppIcon name="clock" :size="20" />
      {{ t("dashboard.clock.title") }}
    </h2>
    <p class="font-mono text-4xl font-bold tabular-nums">
      <time :datetime="toIsoUtcSeconds(now)">{{ formatUtcTime(now) }}</time>
      <span class="ml-2 text-lg text-fg-muted">{{ t("clock.utc") }}</span>
    </p>
    <p class="text-fg-muted">
      <span class="sr-only">{{ t("dashboard.clock.date") }}</span>
      {{ formatUtcDate(now) }}
    </p>
  </section>
</template>
