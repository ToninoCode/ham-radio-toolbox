import type { ModuleManifest } from "@/shared/modules";

// TODO(M11): implement the module; until then the route shows the
// "In sviluppo" view (FR-GEN-07).
export const manifest: ModuleManifest = {
  id: "aprs-explorer",
  path: "/aprs-explorer",
  area: "ham",
  workspaces: ["ham"],
  icon: "map-pin",
  titleKey: "modules.aprs-explorer.title",
  descriptionKey: "modules.aprs-explorer.description",
  availability: { status: "in-development", milestone: "M11" },
};
