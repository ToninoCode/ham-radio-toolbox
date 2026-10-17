import type { ModuleManifest } from "@/shared/modules";

// TODO(M11): implement the module; until then the route shows the
// "In sviluppo" view (FR-GEN-07).
export const manifest: ModuleManifest = {
  id: "repeater-explorer",
  path: "/repeater-explorer",
  area: "ham",
  workspaces: ["ham"],
  icon: "tower",
  titleKey: "modules.repeater-explorer.title",
  descriptionKey: "modules.repeater-explorer.description",
  availability: { status: "in-development", milestone: "M11" },
};
