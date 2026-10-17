import type { ModuleManifest } from "@/shared/modules";

// TODO(M4): implement the module; until then the route shows the
// "In sviluppo" view (FR-GEN-07).
export const manifest: ModuleManifest = {
  id: "swl-logbook",
  path: "/swl-logbook",
  area: "swl",
  workspaces: ["swl"],
  icon: "headphones",
  titleKey: "modules.swl-logbook.title",
  descriptionKey: "modules.swl-logbook.description",
  availability: { status: "in-development", milestone: "M4" },
};
