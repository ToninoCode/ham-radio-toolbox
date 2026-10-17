<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "@/shared/i18n";
import AppHeader from "./AppHeader.vue";
import AppSidebar from "./AppSidebar.vue";
import BottomNav from "./BottomNav.vue";
import ModuleMenuDialog from "./ModuleMenuDialog.vue";

const { t } = useI18n();
const route = useRoute();
const main = useTemplateRef<HTMLElement>("main");
const menu = useTemplateRef<InstanceType<typeof ModuleMenuDialog>>("menu");

function focusMain(): void {
  main.value?.focus();
}

/*
 * After an in-app navigation move focus to the new content, so keyboard and
 * screen reader users start from the page and not from the old link.
 */
watch(
  () => route.path,
  (_path, previous) => {
    if (previous !== undefined) void nextTick(focusMain);
  },
);
</script>

<template>
  <a
    href="#main-content"
    class="sr-only z-50 rounded-lg bg-accent px-4 py-3 font-semibold text-accent-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    @click.prevent="focusMain"
  >
    {{ t("app.skipToContent") }}
  </a>
  <AppHeader />
  <div class="flex">
    <AppSidebar />
    <main
      id="main-content"
      ref="main"
      tabindex="-1"
      class="min-w-0 flex-1 px-4 pt-6 pb-28 focus:outline-none sm:px-6 sm:pb-10 lg:px-8"
    >
      <!-- In-flow app notifications: they push the page down, never cover it. -->
      <slot name="notifications" />
      <RouterView />
    </main>
  </div>
  <BottomNav @open-menu="menu?.open()" />
  <ModuleMenuDialog ref="menu" />
</template>
