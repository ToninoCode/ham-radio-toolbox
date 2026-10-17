<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/shared/i18n";
import type { ModuleManifest } from "@/shared/modules";
import { AppIcon, AREA_STYLES } from "@/shared/ui";

const props = withDefaults(
  defineProps<{ manifest: ModuleManifest; rail?: boolean }>(),
  { rail: false },
);

const { t } = useI18n();
const title = computed(() => t(props.manifest.titleKey));
const areaText = computed(() => AREA_STYLES[props.manifest.area].text);

// RouterLink sets aria-current="page" on the exact active route.
</script>

<template>
  <RouterLink
    :to="manifest.path"
    :title="rail ? title : undefined"
    class="flex min-h-touch items-center gap-3 rounded-lg px-3 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg aria-[current=page]:bg-surface-muted aria-[current=page]:font-semibold aria-[current=page]:text-fg"
    :class="rail ? 'justify-center lg:justify-start' : ''"
    :data-module="manifest.id"
  >
    <span :class="areaText"><AppIcon :name="manifest.icon" :size="22" /></span>
    <span :class="rail ? 'sr-only lg:not-sr-only' : ''">{{ title }}</span>
  </RouterLink>
</template>
