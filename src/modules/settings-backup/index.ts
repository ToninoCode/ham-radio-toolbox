import type { ModuleManifest } from "@/shared/modules";

// TODO(M2): implement the module; until then the route shows the
// "In sviluppo" view (FR-GEN-07).
export const manifest: ModuleManifest = {
  id: "settings-backup",
  path: "/settings-backup",
  area: "shared",
  workspaces: ["ham", "swl"],
  icon: "sliders",
  titleKey: "modules.settings-backup.title",
  descriptionKey: "modules.settings-backup.description",
  availability: { status: "in-development", milestone: "M2" },
};
