import type { ModuleManifest } from "@/shared/modules";

// TODO(M9): implement the module; until then the route shows the
// "In sviluppo" view (FR-GEN-07).
export const manifest: ModuleManifest = {
  id: "resource-manager",
  path: "/resource-manager",
  area: "shared",
  workspaces: ["ham", "swl"],
  icon: "bookmark",
  titleKey: "modules.resource-manager.title",
  descriptionKey: "modules.resource-manager.description",
  availability: { status: "in-development", milestone: "M9" },
};
