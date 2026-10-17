import type { ModuleManifest } from "@/shared/modules";

// TODO(M8): implement the module; until then the route shows the
// "In sviluppo" view (FR-GEN-07).
export const manifest: ModuleManifest = {
  id: "satellite-explorer",
  path: "/satellite-explorer",
  area: "shared",
  workspaces: ["ham", "swl"],
  icon: "satellite",
  titleKey: "modules.satellite-explorer.title",
  descriptionKey: "modules.satellite-explorer.description",
  availability: { status: "in-development", milestone: "M8" },
};
