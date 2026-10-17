import type { ModuleManifest } from "@/shared/modules";

// TODO(M6): implement the module; until then the route shows the
// "In sviluppo" view (FR-GEN-07).
export const manifest: ModuleManifest = {
  id: "rf-calculators",
  path: "/rf-calculators",
  area: "shared",
  workspaces: ["ham", "swl"],
  icon: "calculator",
  titleKey: "modules.rf-calculators.title",
  descriptionKey: "modules.rf-calculators.description",
  availability: { status: "in-development", milestone: "M6" },
};
