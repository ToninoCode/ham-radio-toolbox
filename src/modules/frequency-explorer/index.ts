import type { ModuleManifest } from "@/shared/modules";

// TODO(M5): implement the module; until then the route shows the
// "In sviluppo" view (FR-GEN-07).
export const manifest: ModuleManifest = {
  id: "frequency-explorer",
  path: "/frequency-explorer",
  area: "swl",
  workspaces: ["swl", "ham"],
  icon: "frequency",
  titleKey: "modules.frequency-explorer.title",
  descriptionKey: "modules.frequency-explorer.description",
  availability: { status: "in-development", milestone: "M5" },
};
