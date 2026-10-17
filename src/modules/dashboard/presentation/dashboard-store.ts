import { defineStore } from "pinia";
import { ref } from "vue";
import type { ModuleId, Workspace } from "@/shared/modules";

export type WorkspaceFilter = Workspace | "all";

/**
 * Dashboard UI state: active workspace (FR-DSH-02) and favourite modules
 * in pinning order (FR-DSH-03).
 *
 * TODO(M2): persist favourites and their order in `settings` (key
 * `dashboard`) through the settings use cases. Until then the state lives in
 * memory only and the dashboard says so.
 */
export const useDashboardStore = defineStore("dashboard", () => {
  const workspace = ref<WorkspaceFilter>("all");
  const favorites = ref<ModuleId[]>([]);

  function setWorkspace(value: WorkspaceFilter): void {
    workspace.value = value;
  }

  function isFavorite(id: ModuleId): boolean {
    return favorites.value.includes(id);
  }

  function toggleFavorite(id: ModuleId): void {
    favorites.value = isFavorite(id)
      ? favorites.value.filter((favorite) => favorite !== id)
      : [...favorites.value, id];
  }

  return { workspace, favorites, setWorkspace, isFavorite, toggleFavorite };
});
