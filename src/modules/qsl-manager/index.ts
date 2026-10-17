import type { ModuleManifest } from "@/shared/modules";

// TODO(M10): implement the module; until then the route shows the
// "In sviluppo" view (FR-GEN-07).
export const manifest: ModuleManifest = {
  id: "qsl-manager",
  path: "/qsl-manager",
  area: "ham",
  workspaces: ["ham", "swl"],
  icon: "card",
  titleKey: "modules.qsl-manager.title",
  descriptionKey: "modules.qsl-manager.description",
  availability: { status: "in-development", milestone: "M10" },
};
