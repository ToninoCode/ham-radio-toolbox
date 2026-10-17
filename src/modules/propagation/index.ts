import type { ModuleManifest } from "@/shared/modules";

// TODO(M12): implement the module; until then the route shows the
// "In sviluppo" view (FR-GEN-07).
export const manifest: ModuleManifest = {
  id: "propagation",
  path: "/propagation",
  area: "shared",
  workspaces: ["ham", "swl"],
  icon: "sun",
  titleKey: "modules.propagation.title",
  descriptionKey: "modules.propagation.description",
  availability: { status: "in-development", milestone: "M12" },
};
