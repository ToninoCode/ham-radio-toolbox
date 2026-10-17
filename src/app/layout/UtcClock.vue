<script setup lang="ts">
import { useUtcClock } from "@/shared/composables";
import { formatUtcTime, toIsoUtcSeconds, useI18n } from "@/shared/i18n";

const { t } = useI18n();
const now = useUtcClock();

// Not a live region: announcing every second would be unusable.
</script>

<template>
  <p
    class="inline-flex items-baseline gap-1 font-mono text-sm tabular-nums sm:text-base"
    data-testid="utc-clock"
  >
    <span class="sr-only">{{ t("clock.label") }}</span>
    <time :datetime="toIsoUtcSeconds(now)">{{ formatUtcTime(now) }}</time>
    <span class="text-xs font-semibold text-fg-muted">{{
      t("clock.utc")
    }}</span>
  </p>
</template>
