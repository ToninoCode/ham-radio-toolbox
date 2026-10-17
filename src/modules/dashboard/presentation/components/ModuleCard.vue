<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/shared/i18n";
import type { ModuleId, ModuleManifest } from "@/shared/modules";
import { AppBadge, AppIcon, AppIconButton, AREA_STYLES } from "@/shared/ui";

const props = withDefaults(
  defineProps<{
    manifest: ModuleManifest;
    favorite: boolean;
    headingLevel?: 3 | 4;
  }>(),
  { headingLevel: 3 },
);

const emit = defineEmits<{ "toggle-favorite": [id: ModuleId] }>();

const { t } = useI18n();

const title = computed(() => t(props.manifest.titleKey));
const area = computed(() => AREA_STYLES[props.manifest.area]);
const milestone = computed(() =>
  props.manifest.availability.status === "in-development"
    ? props.manifest.availability.milestone
    : undefined,
);
const favoriteLabel = computed(() =>
  props.favorite
    ? t("dashboard.favorites.remove", { module: title.value })
    : t("dashboard.favorites.add", { module: title.value }),
);

// Stretched link: the whole card opens the module; the star stays separate.
</script>

<template>
  <article
    class="relative flex flex-col gap-3 rounded-card border border-t-4 border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
    :class="area.border"
    :data-module="manifest.id"
    data-testid="module-card"
  >
    <div class="flex items-start gap-3">
      <span class="pt-2" :class="area.text"
        ><AppIcon :name="manifest.icon" :size="28"
      /></span>
      <component
        :is="`h${headingLevel}`"
        class="flex-1 pt-2 text-base font-semibold"
      >
        <RouterLink
          :to="manifest.path"
          class="rounded-sm after:absolute after:inset-0 after:rounded-card after:content-['']"
        >
          {{ title }}
        </RouterLink>
      </component>
      <AppIconButton
        class="relative z-10 -mt-1 -mr-2"
        :class="favorite ? 'text-warning' : ''"
        :icon="favorite ? 'star-filled' : 'star'"
        :label="favoriteLabel"
        data-testid="favorite-toggle"
        @click="emit('toggle-favorite', manifest.id)"
      />
    </div>
    <p class="text-sm text-fg-muted">{{ t(manifest.descriptionKey) }}</p>
    <div class="mt-auto flex flex-wrap items-center gap-2">
      <AppBadge v-if="milestone" tone="warning">{{
        t("availability.inDevelopment")
      }}</AppBadge>
      <AppBadge v-else tone="success">{{
        t("availability.available")
      }}</AppBadge>
      <AppBadge v-if="milestone">{{
        t("availability.plannedIn", { milestone })
      }}</AppBadge>
      <span class="ml-auto text-xs font-semibold" :class="area.text">
        {{ t(`areas.${manifest.area}.short`) }}
      </span>
    </div>
  </article>
</template>
