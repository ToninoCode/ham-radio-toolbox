<script setup lang="ts">
import { useI18n } from "@/shared/i18n";
import { AppIcon, EmptyState } from "@/shared/ui";

const { t } = useI18n();

// TODO(M5): list the imported sources with age and expiry (FR-DSH-05).
// In M1 no source exists, so only the empty state is shown (D-13).
</script>

<template>
  <section
    class="flex flex-col gap-3 rounded-card border border-border bg-surface p-5"
    aria-labelledby="dashboard-freshness-title"
    data-testid="data-freshness"
  >
    <h2
      id="dashboard-freshness-title"
      class="flex items-center gap-2 font-semibold"
    >
      <AppIcon name="database" :size="20" />
      {{ t("dashboard.dataFreshness.title") }}
    </h2>
    <EmptyState
      :title="t('dashboard.dataFreshness.empty')"
      icon="database"
      compact
    >
      <p>{{ t("dashboard.dataFreshness.note") }}</p>
    </EmptyState>
  </section>
</template>
