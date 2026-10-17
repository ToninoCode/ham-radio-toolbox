<script setup lang="ts">
import { useI18n } from "@/shared/i18n";
import { useModuleCatalog } from "@/shared/modules";
import { AppIcon } from "@/shared/ui";
import ConnectionStatus from "./ConnectionStatus.vue";
import ThemeSelector from "./ThemeSelector.vue";
import UtcClock from "./UtcClock.vue";

const { t } = useI18n();
const catalog = useModuleCatalog();
</script>

<template>
  <header
    class="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-surface px-2 sm:gap-4 sm:px-4"
    data-testid="app-header"
  >
    <RouterLink
      :to="catalog.home.path"
      class="flex min-h-touch min-w-touch items-center gap-2 rounded-lg px-1 font-bold text-fg"
    >
      <span class="text-accent"><AppIcon name="antenna" :size="28" /></span>
      <span class="sr-only sm:not-sr-only">{{ t("app.name") }}</span>
    </RouterLink>
    <div class="ml-auto flex items-center gap-2 sm:gap-4">
      <ConnectionStatus />
      <UtcClock />
      <div class="hidden sm:block">
        <ThemeSelector />
      </div>
    </div>
  </header>
</template>
