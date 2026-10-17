import type { ModuleManifest } from "@/shared/modules";

export const manifest: ModuleManifest = {
  id: "dashboard",
  path: "/",
  area: "shared",
  workspaces: ["ham", "swl"],
  icon: "home",
  titleKey: "modules.dashboard.title",
  descriptionKey: "modules.dashboard.description",
  availability: { status: "available" },
  view: () => import("./presentation/views/DashboardView.vue"),
};
