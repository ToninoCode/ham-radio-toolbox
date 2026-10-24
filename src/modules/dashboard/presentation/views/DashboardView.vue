<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed } from "vue";
import { usePreferencesStore } from "@/modules/settings-backup";
import { useI18n } from "@/shared/i18n";
import { useModuleCatalog } from "@/shared/modules";
import {
  AppIcon,
  AREA_STYLES,
  EmptyState,
  PageHeader,
  SegmentedControl,
  type SegmentedOption,
} from "@/shared/ui";
import DataFreshnessPanel from "../components/DataFreshnessPanel.vue";
import ModuleCard from "../components/ModuleCard.vue";
import UtcClockCard from "../components/UtcClockCard.vue";
import { useDashboardStore, type WorkspaceFilter } from "../dashboard-store";

const { t } = useI18n();
const catalog = useModuleCatalog();
const store = useDashboardStore();
const preferences = usePreferencesStore();
const { favorites } = storeToRefs(store);

/** What the user must know about saving the favourites, if anything. */
const favoritesNote = computed(() => {
  if (preferences.status === "unavailable") {
    return t("dashboard.favorites.notPersisted");
  }
  if (preferences.saveError) return t("dashboard.favorites.notSaved");
  if (preferences.invalid.includes("dashboard")) {
    return t("dashboard.favorites.invalid");
  }
  return undefined;
});

const workspace = computed({
  get: () => store.workspace,
  set: (value: WorkspaceFilter) => store.setWorkspace(value),
});

const workspaceOptions = computed<SegmentedOption<WorkspaceFilter>[]>(() => [
  { value: "all", label: t("workspace.all") },
  { value: "ham", label: t("workspace.ham"), icon: "antenna" },
  { value: "swl", label: t("workspace.swl"), icon: "headphones" },
]);

const groups = computed(() => catalog.byArea(workspace.value));
const visibleCount = computed(() =>
  groups.value.reduce((total, group) => total + group.modules.length, 0),
);
const favoriteModules = computed(() =>
  favorites.value.map((id) => catalog.get(id)),
);
</script>

<template>
  <div class="mx-auto flex max-w-7xl flex-col gap-8" data-testid="dashboard">
    <PageHeader :title="t('modules.dashboard.title')">
      <p>{{ t("dashboard.intro") }}</p>
    </PageHeader>

    <div class="grid gap-4 md:grid-cols-2">
      <UtcClockCard />
      <DataFreshnessPanel />
    </div>

    <section
      class="flex flex-col gap-3"
      aria-labelledby="favorites-title"
      data-testid="favorites"
    >
      <h2
        id="favorites-title"
        class="flex items-center gap-2 text-xl font-semibold"
      >
        <AppIcon name="star" :size="22" />
        {{ t("dashboard.favorites.title") }}
      </h2>
      <div aria-live="polite">
        <p
          v-if="favoritesNote"
          class="flex items-start gap-2 text-sm text-fg"
          data-testid="favorites-note"
        >
          <span class="text-warning"><AppIcon name="alert" :size="18" /></span>
          {{ favoritesNote }}
        </p>
      </div>
      <p
        v-if="preferences.status === 'loading' && favoriteModules.length === 0"
        role="status"
        class="text-sm text-fg-muted"
      >
        {{ t("dashboard.favorites.loading") }}
      </p>
      <EmptyState
        v-else-if="favoriteModules.length === 0"
        :title="t('dashboard.favorites.empty')"
        icon="star"
        compact
      />
      <ul v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="manifest in favoriteModules" :key="manifest.id" class="flex">
          <ModuleCard
            class="flex-1"
            :manifest="manifest"
            favorite
            @toggle-favorite="store.toggleFavorite"
          />
        </li>
      </ul>
    </section>

    <section class="flex flex-col gap-6" aria-labelledby="modules-title">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <h2 id="modules-title" class="text-xl font-semibold">
          {{ t("dashboard.modulesHeading") }}
          <span
            class="ml-2 text-base font-normal text-fg-muted"
            data-testid="module-count"
          >
            {{ t("dashboard.moduleCount", { count: visibleCount }) }}
          </span>
        </h2>
        <SegmentedControl
          v-model="workspace"
          :legend="t('workspace.label')"
          :options="workspaceOptions"
          data-testid="workspace-filter"
        />
      </div>

      <section
        v-for="group in groups"
        :key="group.area"
        class="flex flex-col gap-3"
        :aria-labelledby="`area-${group.area}-title`"
        :data-area="group.area"
      >
        <div class="border-l-4 pl-3" :class="AREA_STYLES[group.area].border">
          <h3
            :id="`area-${group.area}-title`"
            class="flex items-center gap-2 text-lg font-semibold"
            :class="AREA_STYLES[group.area].text"
          >
            <AppIcon :name="AREA_STYLES[group.area].icon" :size="22" />
            {{ t(`areas.${group.area}.title`) }}
          </h3>
          <p class="text-sm text-fg-muted">
            {{ t(`areas.${group.area}.description`) }}
          </p>
        </div>
        <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <li v-for="manifest in group.modules" :key="manifest.id" class="flex">
            <ModuleCard
              class="flex-1"
              :manifest="manifest"
              :favorite="store.isFavorite(manifest.id)"
              :heading-level="4"
              @toggle-favorite="store.toggleFavorite"
            />
          </li>
        </ul>
      </section>
    </section>
  </div>
</template>
