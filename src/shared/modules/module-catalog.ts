import { inject, type InjectionKey } from "vue";
import {
  MODULE_AREAS,
  type ModuleArea,
  type ModuleId,
  type ModuleManifest,
  type Workspace,
} from "./module-manifest";

export interface ModuleCatalog {
  /** Every module, in declaration order. */
  readonly all: readonly ModuleManifest[];
  /** Modules shown as cards and in the navigation (all but the home). */
  readonly tools: readonly ModuleManifest[];
  readonly home: ModuleManifest;
  get(id: ModuleId): ModuleManifest;
  /** Modules relevant to a workspace (or all), grouped and ordered by area. */
  byArea(
    workspace: Workspace | "all",
  ): readonly { area: ModuleArea; modules: readonly ModuleManifest[] }[];
}

export const HOME_MODULE_ID: ModuleId = "dashboard";

/**
 * Area order for each workspace: the workspace's own area first, then the
 * shared tools, then the other area (FR-DSH-02 "filtrano e ordinano").
 */
const AREA_ORDER: Readonly<Record<Workspace | "all", readonly ModuleArea[]>> = {
  all: MODULE_AREAS,
  ham: ["ham", "shared", "swl"],
  swl: ["swl", "shared", "ham"],
};

export function createModuleCatalog(
  manifests: readonly ModuleManifest[],
): ModuleCatalog {
  const byId = new Map<ModuleId, ModuleManifest>();
  const paths = new Set<string>();

  for (const manifest of manifests) {
    if (byId.has(manifest.id)) {
      throw new Error(`Duplicate module id: ${manifest.id}`);
    }
    if (paths.has(manifest.path)) {
      throw new Error(`Duplicate module path: ${manifest.path}`);
    }
    if (manifest.availability.status === "available" && !manifest.view) {
      throw new Error(`Available module without a view: ${manifest.id}`);
    }
    byId.set(manifest.id, manifest);
    paths.add(manifest.path);
  }

  const home = byId.get(HOME_MODULE_ID);
  if (!home) throw new Error(`Missing home module: ${HOME_MODULE_ID}`);

  const tools = manifests.filter((m) => m.id !== HOME_MODULE_ID);

  return {
    all: manifests,
    tools,
    home,
    get(id) {
      const manifest = byId.get(id);
      if (!manifest) throw new Error(`Unknown module: ${id}`);
      return manifest;
    },
    byArea(workspace) {
      const relevant =
        workspace === "all"
          ? tools
          : tools.filter((m) => m.workspaces.includes(workspace));
      return AREA_ORDER[workspace]
        .map((area) => ({
          area,
          modules: relevant.filter((m) => m.area === area),
        }))
        .filter((group) => group.modules.length > 0);
    },
  };
}

export const MODULE_CATALOG_KEY: InjectionKey<ModuleCatalog> =
  Symbol("ModuleCatalog");

/** Module catalog provided by the composition root (ARCHITECTURE.md § 5.3). */
export function useModuleCatalog(): ModuleCatalog {
  const catalog = inject(MODULE_CATALOG_KEY);
  if (!catalog) {
    throw new Error("Module catalog not provided: see src/app/main.ts");
  }
  return catalog;
}
