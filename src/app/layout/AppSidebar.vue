<script setup lang="ts">
import { useI18n } from "@/shared/i18n";
import { useModuleCatalog } from "@/shared/modules";
import ModuleNavLink from "./ModuleNavLink.vue";

const { t } = useI18n();
const catalog = useModuleCatalog();
const groups = catalog.byArea("all");

// Icon rail on tablet portrait (sm–lg), full sidebar from lg.
</script>

<template>
  <nav
    :aria-label="t('nav.primary')"
    class="sticky top-16 hidden h-[calc(100dvh-4rem)] w-rail shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-surface p-2 sm:flex lg:w-sidebar lg:p-3"
    data-testid="sidebar"
  >
    <ModuleNavLink :manifest="catalog.home" rail />
    <template v-for="group in groups" :key="group.area">
      <h2
        :id="`nav-area-${group.area}`"
        class="mt-3 border-t border-border px-1 pt-3 text-xs font-semibold tracking-wide text-fg-muted uppercase lg:px-3"
      >
        <span class="hidden lg:inline">{{
          t(`areas.${group.area}.title`)
        }}</span>
        <span class="lg:hidden">{{ t(`areas.${group.area}.short`) }}</span>
      </h2>
      <ul
        class="flex flex-col gap-1"
        :aria-labelledby="`nav-area-${group.area}`"
      >
        <li v-for="manifest in group.modules" :key="manifest.id">
          <ModuleNavLink :manifest="manifest" rail />
        </li>
      </ul>
    </template>
  </nav>
</template>
