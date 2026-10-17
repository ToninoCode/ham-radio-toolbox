<script setup lang="ts">
import { useTemplateRef, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "@/shared/i18n";
import { useModuleCatalog } from "@/shared/modules";
import { AppIconButton } from "@/shared/ui";
import ModuleNavLink from "./ModuleNavLink.vue";
import ThemeSelector from "./ThemeSelector.vue";

const { t } = useI18n();
const catalog = useModuleCatalog();
const groups = catalog.byArea("all");
const route = useRoute();
const dialog = useTemplateRef<HTMLDialogElement>("dialog");

/** Native modal dialog: focus trap, Escape and inert background for free. */
function open(): void {
  if (dialog.value && !dialog.value.open) dialog.value.showModal();
}

function close(): void {
  if (dialog.value?.open) dialog.value.close();
}

watch(() => route.fullPath, close);

defineExpose({ open, close });
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="module-menu-title"
    class="m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-0 text-fg backdrop:bg-black/60"
    data-testid="module-menu"
  >
    <div
      class="flex flex-col gap-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <div class="flex items-center justify-between gap-2">
        <h2 id="module-menu-title" class="text-lg font-semibold">
          {{ t("nav.menuTitle") }}
        </h2>
        <AppIconButton
          icon="close"
          :label="t('nav.closeMenu')"
          @click="close"
        />
      </div>
      <ThemeSelector :icon-only="false" />
      <nav :aria-label="t('nav.primary')" class="flex flex-col gap-1">
        <ModuleNavLink :manifest="catalog.home" />
        <template v-for="group in groups" :key="group.area">
          <h3
            :id="`menu-area-${group.area}`"
            class="mt-2 px-3 text-xs font-semibold tracking-wide text-fg-muted uppercase"
          >
            {{ t(`areas.${group.area}.title`) }}
          </h3>
          <ul
            :aria-labelledby="`menu-area-${group.area}`"
            class="flex flex-col gap-1"
          >
            <li v-for="manifest in group.modules" :key="manifest.id">
              <ModuleNavLink :manifest="manifest" />
            </li>
          </ul>
        </template>
      </nav>
    </div>
  </dialog>
</template>
