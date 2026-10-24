import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { usePreferencesStore } from "@/modules/settings-backup";
import { MODULE_IDS, type ModuleId, type Workspace } from "@/shared/modules";

export type WorkspaceFilter = Workspace | "all";

const KNOWN: ReadonlySet<string> = new Set(MODULE_IDS);

function isModuleId(id: string): id is ModuleId {
  return KNOWN.has(id);
}

/**
 * Dashboard UI state: active workspace (FR-DSH-02, in memory) and the
 * favourite modules in pinning order (FR-DSH-03), persisted in `settings`
 * (key `dashboard`) by the preferences store of settings-backup. Ids of
 * modules this version does not know are kept in storage and not shown.
 */
export const useDashboardStore = defineStore("dashboard", () => {
  const preferences = usePreferencesStore();
  const workspace = ref<WorkspaceFilter>("all");
  const favorites = computed<ModuleId[]>(() =>
    preferences.favorites.filter(isModuleId),
  );

  function setWorkspace(value: WorkspaceFilter): void {
    workspace.value = value;
  }

  function isFavorite(id: ModuleId): boolean {
    return preferences.favorites.includes(id);
  }

  function toggleFavorite(id: ModuleId): void {
    void preferences.toggleFavorite(id);
  }

  return { workspace, favorites, setWorkspace, isFavorite, toggleFavorite };
});
