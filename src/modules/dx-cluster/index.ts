import type { ModuleManifest } from "@/shared/modules";

// TODO(M10): implement the module; until then the route shows the
// "In sviluppo" view (FR-GEN-07).
export const manifest: ModuleManifest = {
  id: "dx-cluster",
  path: "/dx-cluster",
  area: "ham",
  workspaces: ["ham"],
  icon: "globe",
  titleKey: "modules.dx-cluster.title",
  descriptionKey: "modules.dx-cluster.description",
  availability: { status: "in-development", milestone: "M10" },
};
