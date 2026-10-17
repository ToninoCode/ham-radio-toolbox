<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "@/shared/i18n";
import { useModuleCatalog } from "@/shared/modules";
import {
  AppBadge,
  AppIcon,
  AREA_STYLES,
  buttonClasses,
  PageHeader,
} from "@/shared/ui";

const { t } = useI18n();
const route = useRoute();
const catalog = useModuleCatalog();

const manifest = computed(() => {
  const id = route.meta.moduleId;
  if (!id) throw new Error(`Route ${route.fullPath} has no moduleId`);
  return catalog.get(id);
});

const milestone = computed(() =>
  manifest.value.availability.status === "in-development"
    ? manifest.value.availability.milestone
    : undefined,
);

const area = computed(() => AREA_STYLES[manifest.value.area]);
</script>

<template>
  <div
    class="mx-auto flex max-w-3xl flex-col gap-6"
    data-testid="under-development"
  >
    <PageHeader :title="t(manifest.titleKey)">
      <p>{{ t(manifest.descriptionKey) }}</p>
    </PageHeader>

    <section
      class="flex flex-col gap-4 rounded-card border border-l-4 border-border bg-surface p-5"
      :class="area.border"
      aria-labelledby="under-development-status"
    >
      <div class="flex flex-wrap items-center gap-3">
        <span :class="area.text"
          ><AppIcon :name="manifest.icon" :size="32"
        /></span>
        <h2 id="under-development-status" class="text-lg font-semibold">
          <AppBadge tone="warning">{{
            t("availability.inDevelopment")
          }}</AppBadge>
        </h2>
        <AppBadge v-if="milestone">
          {{ t("availability.plannedIn", { milestone }) }}
        </AppBadge>
      </div>
      <p>{{ t("underDevelopment.body") }}</p>
      <p v-if="milestone" class="text-fg-muted">
        {{ t("underDevelopment.planned", { milestone }) }}
      </p>
      <div>
        <RouterLink :to="catalog.home.path" :class="buttonClasses('primary')">
          <AppIcon name="arrow-left" :size="20" />
          {{ t("underDevelopment.backToDashboard") }}
        </RouterLink>
      </div>
    </section>
  </div>
</template>
