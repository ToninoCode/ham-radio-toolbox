<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/shared/i18n";
import { useModuleCatalog, type ModuleId } from "@/shared/modules";
import { AppIcon } from "@/shared/ui";

defineEmits<{ "open-menu": [] }>();

const { t } = useI18n();
const catalog = useModuleCatalog();

/** Most frequent destinations on a phone; everything else is under "Altro". */
const SHORTCUTS: readonly ModuleId[] = [
  "dashboard",
  "ham-logbook",
  "swl-logbook",
  "rf-calculators",
];

const items = computed(() => SHORTCUTS.map((id) => catalog.get(id)));

const ITEM_CLASS =
  "flex min-h-14 min-w-touch flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[0.7rem] leading-tight font-medium text-fg-muted aria-[current=page]:text-accent";
</script>

<template>
  <nav
    :aria-label="t('nav.compact')"
    class="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-1 pb-[env(safe-area-inset-bottom)] sm:hidden"
    data-testid="bottom-nav"
  >
    <ul class="flex items-stretch">
      <li v-for="manifest in items" :key="manifest.id" class="flex flex-1">
        <RouterLink
          :to="manifest.path"
          :class="ITEM_CLASS"
          :data-module="manifest.id"
        >
          <AppIcon :name="manifest.icon" :size="22" />
          <span class="text-center">{{ t(manifest.titleKey) }}</span>
        </RouterLink>
      </li>
      <li class="flex flex-1">
        <button
          type="button"
          :class="ITEM_CLASS"
          :aria-label="t('nav.openMenu')"
          aria-haspopup="dialog"
          data-testid="open-menu"
          @click="$emit('open-menu')"
        >
          <AppIcon name="menu" :size="22" />
          <span aria-hidden="true">{{ t("nav.more") }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>
