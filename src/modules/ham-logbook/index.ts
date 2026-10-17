import type { ModuleManifest } from "@/shared/modules";

// TODO(M3): implement the module; until then the route shows the
// "In sviluppo" view (FR-GEN-07).
export const manifest: ModuleManifest = {
  id: "ham-logbook",
  path: "/ham-logbook",
  area: "ham",
  workspaces: ["ham"],
  icon: "logbook",
  titleKey: "modules.ham-logbook.title",
  descriptionKey: "modules.ham-logbook.description",
  availability: { status: "in-development", milestone: "M3" },
};
